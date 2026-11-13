namespace TempHire.Model.SampleData
{
    /// <summary>
    /// Generated sample data: staffing resources with addresses, phone numbers, rates, skills and
    /// work history, so there is enough data to search, compare and ask Quinn about.
    ///
    /// <para>
    /// The data is made up but plausible: each resource has a profession that decides their skills,
    /// job titles and rates, and lives in a real US city with its area code and zip prefix.  A seeded
    /// <see cref="Random"/> makes every run produce the same data.
    /// </para>
    /// </summary>
    public partial class SampleDataProvider
    {
        private List<AddressType> _addressTypes;
        private List<PhoneNumberType> _phoneTypes;
        private List<RateType> _rateTypes;
        private List<State> _states;

        private record City(string Name, string State, string AreaCode, string ZipPrefix);

        private record Profession(string Name, decimal MinHourly, decimal MaxHourly, string[] Skills, string[] Titles);

        private static readonly City[] Cities =
        [
            new("Seattle", "WA", "206", "981"), new("Portland", "OR", "503", "972"),
            new("San Francisco", "CA", "415", "941"), new("Los Angeles", "CA", "213", "900"),
            new("San Diego", "CA", "619", "921"), new("Denver", "CO", "303", "802"),
            new("Austin", "TX", "512", "787"), new("Dallas", "TX", "214", "752"),
            new("Houston", "TX", "713", "770"), new("Chicago", "IL", "312", "606"),
            new("Boston", "MA", "617", "021"), new("New York", "NY", "212", "100"),
            new("Philadelphia", "PA", "215", "191"), new("Atlanta", "GA", "404", "303"),
            new("Miami", "FL", "305", "331"), new("Orlando", "FL", "407", "328"),
            new("Phoenix", "AZ", "602", "850"), new("Salt Lake City", "UT", "801", "841"),
            new("Minneapolis", "MN", "612", "554"), new("Raleigh", "NC", "919", "276"),
            new("Nashville", "TN", "615", "372"), new("Columbus", "OH", "614", "432"),
            new("Detroit", "MI", "313", "482"), new("Madison", "WI", "608", "537")
        ];

        private static readonly Profession[] Professions =
        [
            new("software development", 65, 150,
                ["C#", "TypeScript", "Angular", "SQL", "Azure", "JavaScript", "Python", "React"],
                ["Software Engineer", "Senior Developer", "Web Developer", "Technical Lead"]),
            new("data analysis", 55, 120,
                ["SQL", "Python", "Power BI", "Excel", "Statistics", "Tableau"],
                ["Data Analyst", "BI Developer", "Data Engineer"]),
            new("sales and marketing", 40, 95,
                ["Sales", "Marketing", "Negotiation", "CRM", "Public Speaking", "Social Media"],
                ["Account Executive", "Sales Representative", "Marketing Manager", "Business Development Manager"]),
            new("accounting", 40, 90,
                ["Accounting", "Excel", "Payroll", "QuickBooks", "Auditing", "Tax Preparation"],
                ["Staff Accountant", "Bookkeeper", "Payroll Specialist", "Senior Accountant"]),
            new("design", 50, 115,
                ["UX Design", "Graphic Design", "Figma", "Photoshop", "Illustration", "Prototyping"],
                ["UX Designer", "Graphic Designer", "Product Designer"]),
            new("project management", 60, 130,
                ["Project Management", "Scrum", "Agile", "Budgeting", "Risk Management", "Jira"],
                ["Project Manager", "Scrum Master", "Program Manager"]),
            new("office administration", 25, 50,
                ["Customer Service", "Data Entry", "Scheduling", "Microsoft Office", "Spanish", "Bookkeeping"],
                ["Office Administrator", "Executive Assistant", "Customer Support Specialist"]),
            new("healthcare administration", 30, 65,
                ["Medical Billing", "Medical Coding", "Scheduling", "Customer Service", "HIPAA Compliance"],
                ["Medical Office Assistant", "Medical Billing Specialist", "Patient Coordinator"])
        ];

        private static readonly string[] FirstNames =
        [
            "Olivia", "Liam", "Emma", "Noah", "Ava", "Elijah", "Sophia", "Mateo", "Isabella", "Lucas",
            "Mia", "Ethan", "Amelia", "James", "Harper", "Benjamin", "Evelyn", "Daniel", "Abigail", "Henry",
            "Priya", "Arjun", "Mei", "Kenji", "Fatima", "Omar", "Sofia", "Diego", "Chloe", "Samuel",
            "Grace", "Leo", "Zoe", "Isaac", "Nora", "Gabriel", "Hannah", "Julian", "Aaliyah", "Marcus",
            "Rosa", "Tomás", "Ingrid", "Kwame", "Lena", "Hiro", "Amara", "Felix", "Yasmin", "Owen"
        ];

        private static readonly string[] LastNames =
        [
            "Garcia", "Nguyen", "Patel", "Kim", "Johnson", "Okafor", "Rossi", "Müller", "Andersen", "Silva",
            "Tanaka", "Haddad", "Kowalski", "O'Brien", "Fischer", "Lopez", "Chen", "Ivanova", "Dubois", "Bennett",
            "Hughes", "Reyes", "Mendoza", "Schmidt", "Larsen", "Costa", "Ahmed", "Park", "Novak", "Walsh",
            "Morales", "Brooks", "Sato", "Kaur", "Ramirez", "Foster", "Lindqvist", "Adeyemi", "Moreau", "Price",
            "Castillo", "Weber", "Yamamoto", "Gallagher", "Romero", "Hart", "Ortega", "Bauer", "Doyle", "Sharma"
        ];

        private static readonly string[] Streets =
        [
            "Maple St", "Oak Ave", "Pine St", "Cedar Ln", "Elm St", "Lakeview Dr", "Hillcrest Rd", "Park Ave",
            "Main St", "Washington Blvd", "Sunset Blvd", "River Rd", "Highland Ave", "Church St", "Spring St",
            "Broadway", "Market St", "Jefferson Ave", "Madison Ave", "Lincoln Way"
        ];

        private static readonly string[] Companies =
        [
            "Bluewater Analytics", "Cedar & Pine Retail", "Northlight Media", "Granite Peak Bank",
            "Brightline Logistics", "Juniper Health", "Lakeside Insurance", "Ironwood Manufacturing",
            "Silverleaf Software", "Redwood Credit Union", "Copperline Telecom", "Maple Street Foods",
            "Orchid Pharma", "Harborview Hospital", "Trailhead Outdoor Gear", "Bayside Realty",
            "Quartz Consulting", "Willow Creek Schools", "Falcon Aerospace", "Evergreen Energy",
            "Starling Travel", "Keystone Legal", "Mosaic Design Studio", "Pioneer Freight"
        ];

        private static readonly string[] Highlights =
        [
            "Known for calm, clear communication with clients.",
            "Has mentored several junior colleagues.",
            "Comfortable working remotely and on site.",
            "Prefers long-term assignments but is open to short projects.",
            "Fluent in Spanish.",
            "Fluent in French and conversational in German.",
            "Holds a bachelor's degree from a state university.",
            "Completed a professional certificate program last year.",
            "Volunteers as a tutor on weekends.",
            "Received an employee-of-the-year award at a previous employer."
        ];

        /// <summary>Adds <paramref name="count"/> generated staffing resources with related data.</summary>
        private void GenerateResources(TempHireDbContext context, int count, Random random)
        {
            var firstNames = Shuffle(FirstNames, random);
            var lastNames = Shuffle(LastNames, random);

            for (var i = 0; i < count; i++)
            {
                var profession = Pick(Professions, random);
                var city = Pick(Cities, random);
                var first = firstNames[i % firstNames.Count];
                var last = lastNames[i % lastNames.Count];
                var middle = random.Next(3) == 0 ? "" : ((char)('A' + random.Next(26))).ToString();
                var skills = Shuffle(profession.Skills, random).Take(random.Next(2, 5)).ToList();
                var title = Pick(profession.Titles, random);
                var years = random.Next(2, 26);

                var resource = NewResource(first, middle, last,
                    $"{first} is {WithArticle(title)} with {years} years of experience in " +
                    $"{profession.Name}, strongest in {skills[0]} and {skills[1]}. {Pick(Highlights, random)}");
                context.Add(resource);

                AddAddresses(context, resource, city, random);
                AddPhones(context, resource, city, random);
                AddRates(context, resource, profession, random);
                AddWorkHistory(context, resource, profession, title, city, years, random);

                foreach (var skill in skills)
                {
                    context.Add(NewSkill(resource.Id, skill));
                }
            }
        }

        private void AddAddresses(TempHireDbContext context, StaffingResource resource, City city, Random random)
        {
            var state = _states.Single(s => s.ShortName == city.State);
            context.Add(NewAddress(resource.Id, _addressTypes[0], StreetAddress(random), Apartment(random),
                city.Name, state, Zip(city, random), true));

            // Some have a separate home address in a nearby part of town.
            if (random.Next(3) == 0)
            {
                context.Add(NewAddress(resource.Id, _addressTypes[1], StreetAddress(random), "",
                    city.Name, state, Zip(city, random), false));
            }
        }

        private void AddPhones(TempHireDbContext context, StaffingResource resource, City city, Random random)
        {
            // Mobile first and primary for most; the original data used home numbers.
            var types = random.Next(4) == 0
                ? new[] { _phoneTypes[0], _phoneTypes[2] }
                : new[] { _phoneTypes[2], _phoneTypes[1] };
            var howMany = random.Next(1, 3);

            for (var i = 0; i < howMany; i++)
            {
                context.Add(NewPhone(resource.Id, types[i], city.AreaCode, $"555-{random.Next(1000, 10000)}", i == 0));
            }
        }

        private void AddRates(TempHireDbContext context, StaffingResource resource, Profession profession, Random random)
        {
            var hourly = Math.Round(profession.MinHourly + (decimal)random.NextDouble() * (profession.MaxHourly - profession.MinHourly));
            context.Add(NewRate(resource.Id, _rateTypes[0], hourly));

            if (random.Next(2) == 0)
            {
                // A small discount for booking a whole day or week.
                context.Add(NewRate(resource.Id, _rateTypes[1], Math.Round(hourly * 7.5m / 10) * 10));
            }

            if (random.Next(4) == 0)
            {
                context.Add(NewRate(resource.Id, _rateTypes[2], Math.Round(hourly * 36 / 50) * 50));
            }
        }

        private void AddWorkHistory(TempHireDbContext context, StaffingResource resource, Profession profession,
            string currentTitle, City city, int years, Random random)
        {
            // Consecutive jobs that end recently, oldest first, covering roughly the years of experience.
            var jobs = Math.Clamp(years / 5 + 1, 1, 3);
            var end = new DateTime(2025, 1, 1).AddMonths(-random.Next(0, 18));
            var start = end.AddYears(-years);
            var span = (end - start).TotalDays / jobs;
            var companies = Shuffle(Companies, random);

            for (var i = 0; i < jobs; i++)
            {
                var from = start.AddDays(span * i).Date;
                var to = start.AddDays(span * (i + 1) - 1).Date;
                var title = i == jobs - 1 ? currentTitle : Pick(profession.Titles, random);
                var location = random.Next(3) == 0 ? Pick(Cities, random) : city;

                context.Add(NewWork(resource.Id, from, to, companies[i], $"{location.Name} {location.State}", title,
                    $"Worked as {Article(title)} {title.ToLowerInvariant()} in the {profession.Name} team."));
            }
        }

        private static string StreetAddress(Random random) => $"{random.Next(100, 9900)} {Pick(Streets, random)}";

        private static string Apartment(Random random) => random.Next(4) == 0 ? $"Apt. {random.Next(1, 40)}" : "";

        private static string Zip(City city, Random random) => $"{city.ZipPrefix}{random.Next(0, 100):00}";

        private static string Article(string word) => "AEIOU".Contains(char.ToUpperInvariant(word[0])) ? "an" : "a";

        private static T Pick<T>(IReadOnlyList<T> items, Random random) => items[random.Next(items.Count)];

        /// <summary>A job title in running text: "an account executive", "a UX designer".</summary>
        private static string WithArticle(string title)
        {
            // Lower-case the words, except acronyms like "UX".
            var phrase = string.Join(" ", title.Split(' ')
                .Select(word => word.All(char.IsUpper) ? word : word.ToLowerInvariant()));
            return ("aeiou".Contains(phrase[0]) ? "an " : "a ") + phrase;
        }

        private static List<T> Shuffle<T>(IEnumerable<T> items, Random random) =>
            items.OrderBy(_ => random.Next()).ToList();
    }
}
