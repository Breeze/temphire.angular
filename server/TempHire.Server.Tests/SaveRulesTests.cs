using System.Net;
using Breeze.Persistence;
using Microsoft.EntityFrameworkCore;
using TempHire.Model;
using Xunit;

namespace TempHire.Server.Tests
{
    /// <summary>
    /// What a save may contain, and the validation rules it is checked against: the database as it
    /// will be after the save, not just the entities the client sent.
    /// </summary>
    public sealed class SaveRulesTests : IDisposable
    {
        private readonly SaveFixture _db = new();

        public void Dispose() => _db.Dispose();

        [Fact]
        public async Task ALookupCannotBeChanged()
        {
            using var context = _db.NewContext();
            var state = _db.Load<State>(SaveFixture.StateId);
            state.Name = "Evergreen State";

            var refused = await Assert.ThrowsAsync<EntityErrorsException>(() =>
                _db.SaveAsync(new SaveBundle().Modify(state, new { Name = "Washington" }).Build()));

            Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
            Assert.Equal("NotAuthorized", Assert.Single(refused.EntityErrors).ErrorName);
            Assert.Equal("Washington", _db.Load<State>(SaveFixture.StateId).Name);
        }

        [Fact]
        public async Task ALookupCannotBeAddedEvenWithOtherChanges()
        {
            var resource = SaveFixture.Resource();
            var newType = new AddressType { Id = Guid.NewGuid(), Name = "Holiday", DisplayName = "Holiday Address" };

            var refused = await Assert.ThrowsAsync<EntityErrorsException>(() => _db.SaveAsync(new SaveBundle()
                .Add(resource).Add(SaveFixture.Address(resource.Id)).Add(SaveFixture.Phone(resource.Id))
                .Add(newType)
                .Build()));

            Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
            Assert.Null(_db.Load<AddressType>(newType.Id));
            Assert.Null(_db.Load<StaffingResource>(resource.Id));
        }

        [Fact]
        public async Task AnotherTenantsRowCannotBeChanged()
        {
            var otherTenant = Guid.NewGuid();
            using (var db = _db.NewContext())
            {
                db.Tenants.Add(new Tenant { Id = otherTenant, Name = "Summit Talent", EmailDomain = "summit.test" });
                db.SaveChanges();
            }
            var theirs = SaveFixture.Resource();
            _db.StoreFor(otherTenant, theirs, SaveFixture.Address(theirs.Id), SaveFixture.Phone(theirs.Id));

            // Through a save: refused.  The validation rules see this tenant's rows only, so the
            // resource has no address there, which stops the save before the tenant check does.
            theirs.LastName = "Leigh";
            theirs.RowVersion = 2;
            await Assert.ThrowsAnyAsync<Exception>(() =>
                _db.SaveAsync(new SaveBundle().Modify(theirs, new { LastName = "Lee", RowVersion = 1 }).Build()));

            // The tenant check itself, in TempHireDbContext: the row exists, but not in this tenant.
            using (var db = _db.NewContext())
            {
                db.Attach(theirs).Property(r => r.LastName).IsModified = true;
                Assert.Throws<TenantAccessException>(() => db.SaveChanges());
            }

            using (var db = _db.NewContext())
            {
                db.UseTenant(otherTenant);
                Assert.Equal("Lee", db.StaffingResources.AsNoTracking().Single(r => r.Id == theirs.Id).LastName);
            }
        }

        [Fact]
        public async Task DeletingTheLastAddressIsCaughtWithoutTheResourceInTheSave()
        {
            var (resource, address, _) = _db.StoreValidResource();

            // The save holds only the address.  The rule is the resource's, so the server loads the
            // resource and its other addresses (none) to check it.
            var errors = await Assert.ThrowsAsync<EntityErrorsException>(() => _db.SaveAsync(new SaveBundle().Delete(address).Build()));

            var error = Assert.Single(errors.EntityErrors);
            Assert.Equal("ADDRESS_REQUIRED", error.ErrorName);
            Assert.Equal(typeof(StaffingResource).FullName, error.EntityTypeName);
            Assert.Equal([resource.Id], error.KeyValues.Cast<Guid>());
            Assert.NotNull(_db.Load<Address>(address.Id));
        }

        [Fact]
        public async Task ARuleBrokenByTwoUsersTogetherIsCaught()
        {
            // A resource with two addresses, which two users open at the same time.
            var (resource, first, _) = _db.StoreValidResource();
            var second = SaveFixture.Address(resource.Id);
            _db.Store(second);

            // Each deletes a different address.  Alone, each delete is fine: one address remains.
            await _db.SaveAsync(new SaveBundle().Delete(first).Build());

            // The second save has no stale row in it - the address it deletes is as it was loaded -
            // so there is no concurrency conflict.  It is the rule, checked against the database as
            // it will be after the save, that stops the resource being left with no address.
            var errors = await Assert.ThrowsAsync<EntityErrorsException>(() => _db.SaveAsync(new SaveBundle().Delete(second).Build()));

            Assert.IsNotType<ConcurrencyErrorsException>(errors);
            Assert.Equal("ADDRESS_REQUIRED", Assert.Single(errors.EntityErrors).ErrorName);
            Assert.NotNull(_db.Load<Address>(second.Id));
        }

        [Fact]
        public async Task ReplacingTheLastAddressInOneSaveIsFine()
        {
            var (resource, address, _) = _db.StoreValidResource();
            var replacement = SaveFixture.Address(resource.Id);

            await _db.SaveAsync(new SaveBundle().Delete(address).Add(replacement).Build());

            Assert.Null(_db.Load<Address>(address.Id));
            Assert.NotNull(_db.Load<Address>(replacement.Id));
        }
    }
}
