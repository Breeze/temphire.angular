using System.Web.Http;
using Breeze.ContextProvider.EF6;
using Breeze.WebApi2;

using DomainModel;
using Breeze.ContextProvider;
using Newtonsoft.Json.Linq;
using TempHire.Services;
using System.Linq;

namespace TempHire.Controllers
{
    [BreezeController]
    [Authorize]
    public class DefaultController : ApiController
    {
        private readonly UnitOfWork _unitOfWork = new UnitOfWork();

        // ~/breeze/Metadata
        [HttpGet]
        public string Metadata()
        {
            return new EFContextProvider<TempHireDbContext>().Metadata();
        }

        [HttpPost]
        public SaveResult SaveChanges(JObject saveBundle)
        {
            return _unitOfWork.Commit(saveBundle);
        }

        // ~/breeze/Lookups
        [HttpGet]
        public LookupBundle Lookups()
        {
            return new LookupBundle
            {
                AddressTypes = _unitOfWork.AddressTypes.All().ToList(),
                PhoneNumberTypes = _unitOfWork.PhoneNumberTypes.All().ToList(),
                RateTypes = _unitOfWork.RateTypes.All().ToList(),
                States = _unitOfWork.States.All().ToList()
            };
        }
    }
}