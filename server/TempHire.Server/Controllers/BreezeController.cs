using Breeze.AspNetCore;
using Breeze.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using TempHire.Model;
using TempHire.Model.Projections;
using TempHire.Server.Persistence;

namespace TempHire.Server.Controllers
{
    /// <summary>
    /// The whole data-access surface of the app.
    ///
    /// <para>
    /// In the DevForce version there was no controller at all: the client's <c>EntityManager</c> talked
    /// to the DevForce EntityServer over WCF, and query composition happened client-side against
    /// <c>EntityQuery&lt;T&gt;</c>.  Breeze keeps the same feel - the Angular client still writes
    /// <c>EntityQuery.from('StaffingResources').where(...)</c> - but the query travels to the server as
    /// a JSON payload and <c>[BreezeQueryFilter]</c> applies it to the <see cref="IQueryable{T}"/> that
    /// each method returns.
    /// </para>
    ///
    /// <para>
    /// <c>[Authorize]</c> is the replacement for <c>[RequiresAuthentication]</c> on the DevForce
    /// <c>EntityBase</c>, and it covers <see cref="Metadata"/> too - DevForce would not hand out the
    /// model to an anonymous caller either.
    /// </para>
    /// </summary>
    [Route("api/breeze/[action]")]
    [BreezeQueryFilter]
    [Authorize]
    public class BreezeController : ControllerBase
    {
        private readonly TempHireDbContext _dbContext;
        private TempHirePersistenceManager _persistenceManager;

        public BreezeController(TempHireDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Created lazily: <see cref="ControllerBase.User"/> is not populated until after the controller
        /// has been constructed, and the persistence manager needs it to stamp the audit columns.
        /// </summary>
        private TempHirePersistenceManager PersistenceManager =>
            _persistenceManager ??= new TempHirePersistenceManager(_dbContext, User);

        private TempHireDbContext Context => _dbContext;

        /// <summary>
        /// The Breeze metadata the client's MetadataStore is built from - generated from the EF Core
        /// model.  This is the replacement for DevForce's <c>.ibmmx</c> model file plus the code
        /// generation that produced <c>TempHireEntities</c>.
        /// </summary>
        [HttpGet]
        public string Metadata()
        {
            return PersistenceManager.Metadata();
        }

        /// <summary>
        /// The single write endpoint.  Replaces DevForce's <c>EntityManager.SaveChangesAsync</c> round
        /// trip; the change set arrives as a Breeze "save bundle".
        /// </summary>
        [HttpPost]
        public ActionResult<SaveResult> SaveChanges([FromBody] JObject saveBundle)
        {
            return PersistenceManager.SaveChanges(saveBundle);
        }

        /// <summary>
        /// Aggregate root query.  Mirrors <c>StaffingResourceRepository.GetKeyQuery</c>, which eagerly
        /// pulled in Addresses and PhoneNumbers so that the summary line could be rendered without a
        /// second trip.  Breeze lets the client add its own <c>.expand(...)</c> on top of this.
        /// </summary>
        [HttpGet]
        public IQueryable<StaffingResource> StaffingResources()
        {
            return Context.StaffingResources
                .Include(r => r.Addresses)
                .Include(r => r.PhoneNumbers);
        }

        [HttpGet]
        public IQueryable<Address> Addresses() => Context.Addresses;

        [HttpGet]
        public IQueryable<PhoneNumber> PhoneNumbers() => Context.PhoneNumbers;

        [HttpGet]
        public IQueryable<Rate> Rates() => Context.Rates;

        [HttpGet]
        public IQueryable<Skill> Skills() => Context.Skills;

        [HttpGet]
        public IQueryable<WorkExperienceItem> WorkExperienceItems() => Context.WorkExperienceItems;

        [HttpGet]
        public IQueryable<AddressType> AddressTypes() => Context.AddressTypes;

        [HttpGet]
        public IQueryable<PhoneNumberType> PhoneNumberTypes() => Context.PhoneNumberTypes;

        [HttpGet]
        public IQueryable<RateType> RateTypes() => Context.RateTypes;

        [HttpGet]
        public IQueryable<State> States() => Context.States;

        /// <summary>
        /// One-shot load of every lookup table.
        ///
        /// <para>
        /// This is the replacement for <c>TempHire/GlobalCache.cs</c> plus
        /// <c>GlobalCacheRepository&lt;T&gt;</c>.  DevForce kept a separate, long-lived EntityManager
        /// full of lookup entities and seeded every new manager from it
        /// (<c>QueryStrategy.CacheOnly</c>).  Breeze does the same thing more directly: the client
        /// fetches this bundle once at login into a "master" EntityManager, and every sandbox manager is
        /// created as a copy of it.  See <c>entity-manager-provider.ts</c>.
        /// </para>
        /// </summary>
        [HttpGet]
        public LookupBundle Lookups()
        {
            // This returns a bundle rather than an IQueryable, so there is nothing for the query filter
            // to apply; tell it to stand down.
            this.SkipBreezeQueryFilter();

            return new LookupBundle
            {
                AddressTypes = Context.AddressTypes.OrderBy(t => t.DisplayName).ToList(),
                PhoneNumberTypes = Context.PhoneNumberTypes.OrderBy(t => t.Name).ToList(),
                RateTypes = Context.RateTypes.OrderBy(t => t.Sequence).ToList(),
                States = Context.States.OrderBy(s => s.Name).ToList()
            };
        }

        /// <summary>
        /// Backs the search grid.  Port of <c>DomainServices/Services/StaffingResourceSearchService.cs</c>,
        /// whose <c>Simple(text)</c> built a LINQ predicate over first/middle/last name, the primary
        /// address and the primary phone number, then projected into
        /// <see cref="StaffingResourceListItem"/>.
        ///
        /// <para>
        /// The predicate now runs on the server; it used to be composed on the client and shipped to the
        /// DevForce EntityServer as an expression tree.  Everything else is unchanged, including the
        /// ordering by last name.  The result type is not an entity, so Breeze returns it to the client
        /// as a plain DTO - the direct analogue of DevForce's <c>IKnownType</c> projection.
        /// </para>
        /// </summary>
        [HttpGet]
        public IQueryable<StaffingResourceListItem> StaffingResourceListItems(string searchText = null)
        {
            var query = Context.StaffingResources.AsQueryable();

            if (!string.IsNullOrWhiteSpace(searchText))
            {
                var text = searchText.Trim();

                query = query.Where(x =>
                    x.FirstName.Contains(text) ||
                    x.MiddleName.Contains(text) ||
                    x.LastName.Contains(text) ||
                    x.Addresses.Any(a => a.Primary && (
                        a.Address1.Contains(text) ||
                        a.Address2.Contains(text) ||
                        a.City.Contains(text) ||
                        a.Zipcode.Contains(text) ||
                        a.State.Name.Contains(text) ||
                        a.State.ShortName.Contains(text))) ||
                    x.PhoneNumbers.Any(p => p.Primary && (
                        p.AreaCode.Contains(text) ||
                        p.Number.Contains(text))));
            }

            return query
                .OrderBy(x => x.LastName)
                .Select(x => new
                {
                    Resource = x,
                    PrimaryAddress = x.Addresses.FirstOrDefault(a => a.Primary),
                    PrimaryPhone = x.PhoneNumbers.FirstOrDefault(p => p.Primary)
                })
                .Select(x => new StaffingResourceListItem
                {
                    Id = x.Resource.Id,
                    FirstName = x.Resource.FirstName,
                    MiddleName = x.Resource.MiddleName,
                    LastName = x.Resource.LastName,
                    FullName = string.IsNullOrEmpty(x.Resource.MiddleName)
                        ? x.Resource.FirstName + " " + x.Resource.LastName
                        : x.Resource.FirstName + " " + x.Resource.MiddleName + " " + x.Resource.LastName,
                    Address1 = x.PrimaryAddress.Address1,
                    Address2 = x.PrimaryAddress.Address2,
                    City = x.PrimaryAddress.City,
                    State = x.PrimaryAddress.State.ShortName,
                    Zipcode = x.PrimaryAddress.Zipcode,
                    AreaCode = x.PrimaryPhone.AreaCode,
                    Number = x.PrimaryPhone.Number,
                    PhoneNumber = "(" + x.PrimaryPhone.AreaCode + ") " + x.PrimaryPhone.Number
                });
        }
    }

    /// <summary>
    /// Shape of the <c>Lookups</c> response.  Each collection is materialised into the client's master
    /// EntityManager, which then seeds every sandbox manager - the Breeze equivalent of DevForce's
    /// global cache.
    /// </summary>
    public class LookupBundle
    {
        public IEnumerable<AddressType> AddressTypes { get; set; }
        public IEnumerable<PhoneNumberType> PhoneNumberTypes { get; set; }
        public IEnumerable<RateType> RateTypes { get; set; }
        public IEnumerable<State> States { get; set; }
    }
}
