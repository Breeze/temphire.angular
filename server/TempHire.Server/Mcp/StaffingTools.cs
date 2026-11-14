using System.ComponentModel;
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol.Server;
using TempHire.Model;

namespace TempHire.Server.Mcp
{
    /// <summary>
    /// The MCP server's tools: read-only questions over the staffing data, for Quinn (or any other
    /// MCP client with a TempHire access token).
    ///
    /// <para>
    /// The tools are purpose-built rather than "run this SQL": each answers one kind of question, with
    /// parameters a model can fill in reliably, and returns small JSON results.  They query through
    /// EF Core, so <c>TempHireDbContext</c>'s global query filter limits every one of them to the
    /// caller's tenant.  No tool has a tenant parameter, and the tenant comes from the access token,
    /// so neither the model nor a prompt injection can widen what they see.
    /// </para>
    /// <para>
    /// Every person in a result comes with their id (<c>id</c>, or <c>personId</c> next to
    /// <c>person</c>).  The model has no use for it, but <c>ToolResultPeople</c> picks the people out
    /// of the results, and the client links their names in Quinn's answer to their records.
    /// </para>
    /// <para>
    /// A new instance is created per request, with that request's <see cref="TempHireDbContext"/>.
    /// </para>
    /// </summary>
    [McpServerToolType]
    public class StaffingTools
    {
        private readonly TempHireDbContext _db;

        public StaffingTools(TempHireDbContext db)
        {
            _db = db;
        }

        [McpServerTool(Name = "search_staffing_resources", Title = "Search staffing resources", ReadOnly = true)]
        [Description("Finds staffing resources (the people the company places) by name, skill or location. " +
                     "Use it for any question about who has a skill or who lives somewhere. " +
                     "Returns each person's name, primary city and state, primary phone, skills and hourly rate. " +
                     "Call it with no filters to list everyone.")]
        public async Task<object> SearchStaffingResources(
            [Description("Part of the person's name, e.g. 'Garcia'")] string name = null,
            [Description("Only people with this skill, e.g. 'SQL' (see list_skills)")] string skill = null,
            [Description("Only people whose primary address is in this city")] string city = null,
            [Description("Only people whose primary address is in this state: two-letter code, e.g. 'WA'")] string state = null,
            [Description("Maximum number of people to return; default 30")] int limit = 30,
            CancellationToken cancellationToken = default)
        {
            var query = _db.StaffingResources.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(name))
            {
                query = query.Where(r => (r.FirstName + " " + r.MiddleName + " " + r.LastName).Contains(name.Trim())
                                         || (r.FirstName + " " + r.LastName).Contains(name.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(skill))
            {
                query = query.Where(r => r.Skills.Any(s => s.Description.Contains(skill.Trim())));
            }

            if (!string.IsNullOrWhiteSpace(city))
            {
                query = query.Where(r => r.Addresses.Any(a => a.Primary && a.City.Contains(city.Trim())));
            }

            if (!string.IsNullOrWhiteSpace(state))
            {
                query = query.Where(r => r.Addresses.Any(a => a.Primary && a.State.ShortName == state.Trim()));
            }

            var total = await query.CountAsync(cancellationToken);
            var people = await query
                .OrderBy(r => r.LastName).ThenBy(r => r.FirstName)
                .Take(Math.Clamp(limit, 1, 100))
                .Select(r => new
                {
                    id = r.Id,
                    name = FullName(r.FirstName, r.MiddleName, r.LastName),
                    city = r.Addresses.Where(a => a.Primary).Select(a => a.City).FirstOrDefault(),
                    state = r.Addresses.Where(a => a.Primary).Select(a => a.State.ShortName).FirstOrDefault(),
                    phone = r.PhoneNumbers.Where(p => p.Primary)
                        .Select(p => "(" + p.AreaCode + ") " + p.Number).FirstOrDefault(),
                    skills = r.Skills.OrderBy(s => s.Description).Select(s => s.Description).ToList(),
                    hourlyRate = r.Rates.Where(x => x.RateType.Name == "hourly").Select(x => (decimal?)x.Amount).FirstOrDefault()
                })
                .ToListAsync(cancellationToken);

            return new { matched = total, returned = people.Count, people };
        }

        [McpServerTool(Name = "get_staffing_resource", Title = "Get one staffing resource", ReadOnly = true)]
        [Description("Everything about one person: summary, addresses, phone numbers, rates, skills and work history. " +
                     "If the name matches several people, returns their names instead; ask again with a fuller name.")]
        public async Task<object> GetStaffingResource(
            [Description("The person's name, or part of it, e.g. 'Nancy Davolio'")] string name,
            CancellationToken cancellationToken = default)
        {
            var text = (name ?? "").Trim();
            var matches = await _db.StaffingResources.AsNoTracking()
                .Where(r => (r.FirstName + " " + r.MiddleName + " " + r.LastName).Contains(text)
                            || (r.FirstName + " " + r.LastName).Contains(text))
                .Select(r => new { r.Id, Name = FullName(r.FirstName, r.MiddleName, r.LastName) })
                .ToListAsync(cancellationToken);

            if (matches.Count == 0)
            {
                return new { found = false, message = $"Nobody named '{text}' was found." };
            }

            // "Jane Doe" also matches "Jane M Doe"; if one name is exactly what was asked for, that's the one.
            var exact = matches.Where(m => string.Equals(m.Name, text, StringComparison.OrdinalIgnoreCase)).ToList();
            if (exact.Count == 1)
            {
                matches = exact;
            }

            if (matches.Count > 1)
            {
                return new { found = false, message = "Several people match; ask about one of them.", matches = matches.Select(m => new { id = m.Id, name = m.Name }) };
            }

            var id = matches[0].Id;
            return await _db.StaffingResources.AsNoTracking()
                .Where(r => r.Id == id)
                .Select(r => new
                {
                    found = true,
                    id = r.Id,
                    name = FullName(r.FirstName, r.MiddleName, r.LastName),
                    summary = r.Summary,
                    addresses = r.Addresses.OrderByDescending(a => a.Primary).Select(a => new
                    {
                        type = a.AddressType.DisplayName,
                        street = a.Address1 + (a.Address2 == "" || a.Address2 == null ? "" : ", " + a.Address2),
                        a.City,
                        state = a.State.ShortName,
                        zip = a.Zipcode,
                        primary = a.Primary
                    }),
                    phoneNumbers = r.PhoneNumbers.OrderByDescending(p => p.Primary).Select(p => new
                    {
                        type = p.PhoneNumberType.Name,
                        number = "(" + p.AreaCode + ") " + p.Number,
                        primary = p.Primary
                    }),
                    rates = r.Rates.OrderBy(x => x.RateType.Sequence).Select(x => new { type = x.RateType.DisplayName, amountUsd = x.Amount }),
                    skills = r.Skills.OrderBy(s => s.Description).Select(s => s.Description),
                    workHistory = r.WorkExperience.OrderByDescending(w => w.From).Select(w => new
                    {
                        w.Company,
                        position = w.PositionTitle,
                        w.Location,
                        from = w.From.Year + "-" + w.From.Month,
                        to = w.To.Year + "-" + w.To.Month,
                        w.Description
                    })
                })
                .SingleAsync(cancellationToken);
        }

        [McpServerTool(Name = "list_skills", Title = "List skills", ReadOnly = true)]
        [Description("Every skill in the staffing pool, with how many people have it, most common first. " +
                     "Only counts: to find out who has a skill, use search_staffing_resources with that skill.")]
        public async Task<object> ListSkills(CancellationToken cancellationToken = default)
        {
            var skills = await _db.Skills.AsNoTracking()
                .GroupBy(s => s.Description)
                .Select(g => new { skill = g.Key, people = g.Count() })
                .OrderByDescending(s => s.people).ThenBy(s => s.skill)
                .ToListAsync(cancellationToken);

            return new { skills };
        }

        [McpServerTool(Name = "rate_statistics", Title = "Rate statistics", ReadOnly = true)]
        [Description("Lowest, average and highest rate in US dollars, overall or per state or per skill. " +
                     "Also returns the people with the highest and lowest rate.")]
        public async Task<object> RateStatistics(
            [Description("Which rate: 'hourly' (default), 'daily', 'weekly' or 'monthly'")] string rateType = "hourly",
            [Description("'none' (default) for one overall row, 'state' or 'skill' for one row each")] string groupBy = "none",
            [Description("Only people with this skill")] string skill = null,
            CancellationToken cancellationToken = default)
        {
            var type = (rateType ?? "hourly").Trim().ToLowerInvariant();
            var rates = _db.Rates.AsNoTracking().Where(x => x.RateType.Name == type);

            if (!string.IsNullOrWhiteSpace(skill))
            {
                rates = rates.Where(x => x.StaffingResource.Skills.Any(s => s.Description.Contains(skill.Trim())));
            }

            object rows = (groupBy ?? "none").Trim().ToLowerInvariant() switch
            {
                "state" => await rates
                    .Select(x => new
                    {
                        group = x.StaffingResource.Addresses.Where(a => a.Primary).Select(a => a.State.ShortName).FirstOrDefault(),
                        x.Amount
                    })
                    .GroupBy(x => x.group)
                    .Select(g => new { state = g.Key, people = g.Count(), min = g.Min(x => x.Amount), average = Math.Round(g.Average(x => x.Amount), 2), max = g.Max(x => x.Amount) })
                    .OrderByDescending(g => g.average)
                    .ToListAsync(cancellationToken),

                "skill" => await _db.Skills.AsNoTracking()
                    .SelectMany(s => s.StaffingResource.Rates.Where(x => x.RateType.Name == type), (s, x) => new { s.Description, x.Amount })
                    .Where(x => string.IsNullOrWhiteSpace(skill) || x.Description.Contains(skill.Trim()))
                    .GroupBy(x => x.Description)
                    .Select(g => new { skill = g.Key, people = g.Count(), min = g.Min(x => x.Amount), average = Math.Round(g.Average(x => x.Amount), 2), max = g.Max(x => x.Amount) })
                    .OrderByDescending(g => g.average)
                    .ToListAsync(cancellationToken),

                _ => await rates
                    .GroupBy(_ => 1)
                    .Select(g => new { people = g.Count(), min = g.Min(x => x.Amount), average = Math.Round(g.Average(x => x.Amount), 2), max = g.Max(x => x.Amount) })
                    .ToListAsync(cancellationToken)
            };

            var highest = await rates.OrderByDescending(x => x.Amount)
                .Select(x => new { id = x.StaffingResourceId, name = FullName(x.StaffingResource.FirstName, x.StaffingResource.MiddleName, x.StaffingResource.LastName), amountUsd = x.Amount })
                .FirstOrDefaultAsync(cancellationToken);
            var lowest = await rates.OrderBy(x => x.Amount)
                .Select(x => new { id = x.StaffingResourceId, name = FullName(x.StaffingResource.FirstName, x.StaffingResource.MiddleName, x.StaffingResource.LastName), amountUsd = x.Amount })
                .FirstOrDefaultAsync(cancellationToken);

            return new { rateType = type, currency = "USD", rows, highest, lowest };
        }

        [McpServerTool(Name = "count_by_location", Title = "Count by location", ReadOnly = true)]
        [Description("How many staffing resources live in each state or city (by primary address), most first.")]
        public async Task<object> CountByLocation(
            [Description("'state' (default) or 'city'")] string groupBy = "state",
            CancellationToken cancellationToken = default)
        {
            var primary = _db.Addresses.AsNoTracking().Where(a => a.Primary);

            object rows = (groupBy ?? "state").Trim().ToLowerInvariant() == "city"
                ? await primary.GroupBy(a => new { a.City, a.State.ShortName })
                    .Select(g => new { city = g.Key.City, state = g.Key.ShortName, people = g.Count() })
                    .OrderByDescending(g => g.people).ThenBy(g => g.city)
                    .ToListAsync(cancellationToken)
                : await primary.GroupBy(a => new { a.State.ShortName, a.State.Name })
                    .Select(g => new { state = g.Key.ShortName, stateName = g.Key.Name, people = g.Count() })
                    .OrderByDescending(g => g.people).ThenBy(g => g.state)
                    .ToListAsync(cancellationToken);

            return new { total = await _db.StaffingResources.CountAsync(cancellationToken), rows };
        }

        [McpServerTool(Name = "search_work_history", Title = "Search work history", ReadOnly = true)]
        [Description("Finds past jobs by company, position or location, with who held them and when.")]
        public async Task<object> SearchWorkHistory(
            [Description("Part of the company name, e.g. 'Bluewater'")] string company = null,
            [Description("Part of the position title, e.g. 'Developer'")] string position = null,
            [Description("Part of the location, e.g. 'Seattle'")] string location = null,
            [Description("Maximum number of jobs to return; default 30")] int limit = 30,
            CancellationToken cancellationToken = default)
        {
            var jobs = _db.WorkExperienceItems.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(company))
            {
                jobs = jobs.Where(w => w.Company.Contains(company.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(position))
            {
                jobs = jobs.Where(w => w.PositionTitle.Contains(position.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(location))
            {
                jobs = jobs.Where(w => w.Location.Contains(location.Trim()));
            }

            var total = await jobs.CountAsync(cancellationToken);
            var rows = await jobs
                .OrderByDescending(w => w.To)
                .Take(Math.Clamp(limit, 1, 100))
                .Select(w => new
                {
                    personId = w.StaffingResourceId,
                    person = FullName(w.StaffingResource.FirstName, w.StaffingResource.MiddleName, w.StaffingResource.LastName),
                    w.Company,
                    position = w.PositionTitle,
                    w.Location,
                    from = w.From.Year + "-" + w.From.Month,
                    to = w.To.Year + "-" + w.To.Month
                })
                .ToListAsync(cancellationToken);

            return new { matched = total, returned = rows.Count, jobs = rows };
        }

        /// <summary>
        /// A person's name as every tool returns it: first, middle (if any) and last.  The middle name
        /// matters: "Jane Doe" and "Jane M Doe" are different people, and the model, and the people
        /// <c>ToolResultPeople</c> finds, can only tell them apart if the results do.  Called in the final
        /// projection of each query, which EF Core runs on the client.
        /// </summary>
        private static string FullName(string firstName, string middleName, string lastName) =>
            string.Join(" ", new[] { firstName, middleName, lastName }.Where(part => !string.IsNullOrWhiteSpace(part)).Select(part => part.Trim()));
    }
}
