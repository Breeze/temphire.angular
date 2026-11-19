using System.Net;
using Breeze.Persistence;
using TempHire.Model;
using Xunit;

namespace TempHire.Server.Tests
{
    /// <summary>
    /// Optimistic concurrency: a save may only change or delete a row as the client loaded it.  If
    /// someone else saved or deleted it in the meantime, the save fails as a whole with a concurrency
    /// conflict (409), which the client tells the user about, and nothing is written.
    /// </summary>
    public sealed class ConcurrencyTests : IDisposable
    {
        private readonly SaveFixture _db = new();

        public void Dispose() => _db.Dispose();

        [Fact]
        public void TheEntitiesTheClientCanSaveHaveAConcurrencyToken_TheLookupsDoNot()
        {
            using var context = _db.NewContext();
            foreach (var type in context.Model.GetEntityTypes().Select(t => t.ClrType))
            {
                var rowVersion = context.Model.FindEntityType(type)!.FindProperty(nameof(AuditEntityBase.RowVersion));
                if (typeof(AuditEntityBase).IsAssignableFrom(type))
                {
                    Assert.True(rowVersion?.IsConcurrencyToken, $"{type.Name} has no concurrency token");
                }
                else
                {
                    Assert.Null(rowVersion);
                }
            }
        }

        [Fact]
        public async Task ASaveFromTheBreezeClientIncrementsTheVersionOnce()
        {
            var (resource, _, _) = _db.StoreValidResource();

            // The Breeze client increments a concurrency property itself before it saves, and sends
            // the version it loaded among the original values.
            resource.LastName = "Leigh";
            resource.RowVersion = 2;
            await _db.SaveAsync(new SaveBundle().Modify(resource, new { LastName = "Lee", RowVersion = 1 }).Build());

            var stored = _db.Load<StaffingResource>(resource.Id);
            Assert.Equal("Leigh", stored.LastName);
            Assert.Equal(2, stored.RowVersion);
            Assert.Equal("anna@harbor.test", stored.ModifyUser);
        }

        [Fact]
        public async Task ASaveThatDoesNotIncrementTheVersionGetsANewOneAnyway()
        {
            var (resource, _, _) = _db.StoreValidResource();

            resource.LastName = "Leigh";
            await _db.SaveAsync(new SaveBundle().Modify(resource, new { LastName = "Lee" }).Build());

            Assert.Equal(2, _db.Load<StaffingResource>(resource.Id).RowVersion);
        }

        [Fact]
        public async Task ChangingARowSomeoneElseChangedIsAConflict()
        {
            var (resource, _, _) = _db.StoreValidResource();
            await SomeoneElseRenames(resource.Id, "Lane");

            // Saved from the version this user loaded, 1, which is no longer the stored one.
            resource.LastName = "Leigh";
            resource.RowVersion = 2;
            var conflict = await Assert.ThrowsAsync<ConcurrencyErrorsException>(() =>
                _db.SaveAsync(new SaveBundle().Modify(resource, new { LastName = "Lee", RowVersion = 1 }).Build()));

            Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
            var error = Assert.Single(conflict.EntityErrors);
            Assert.Equal(ConcurrencyErrorsException.ErrorName, error.ErrorName);
            Assert.Equal(typeof(StaffingResource).FullName, error.EntityTypeName);
            Assert.Equal([resource.Id], error.KeyValues.Cast<Guid>());

            Assert.Equal("Lane", _db.Load<StaffingResource>(resource.Id).LastName);
        }

        [Fact]
        public async Task DeletingARowSomeoneElseChangedIsAConflict()
        {
            var (resource, address, _) = _db.StoreValidResource();
            var second = SaveFixture.Address(resource.Id);
            _db.Store(second);

            // Someone else edits the address; this user, from the version they loaded, deletes it.
            var edited = _db.Load<Address>(address.Id);
            edited.City = "Tacoma";
            edited.RowVersion = 2;
            await _db.SaveAsync(new SaveBundle().Modify(edited, new { City = "Seattle", RowVersion = 1 }).Build());

            await Assert.ThrowsAsync<ConcurrencyErrorsException>(() => _db.SaveAsync(new SaveBundle().Delete(address).Build()));
            Assert.NotNull(_db.Load<Address>(address.Id));
        }

        [Fact]
        public async Task ChangingARowSomeoneElseDeletedIsAConflict()
        {
            var (resource, address, _) = _db.StoreValidResource();
            _db.Store(SaveFixture.Address(resource.Id));

            // Someone else deletes the address (the resource keeps its other one); this user edits it.
            await _db.SaveAsync(new SaveBundle().Delete(_db.Load<Address>(address.Id)).Build());

            address.City = "Tacoma";
            address.RowVersion = 2;
            await Assert.ThrowsAsync<ConcurrencyErrorsException>(() =>
                _db.SaveAsync(new SaveBundle().Modify(address, new { City = "Seattle", RowVersion = 1 }).Build()));
        }

        [Fact]
        public async Task AConflictWritesNothing()
        {
            var (resource, address, _) = _db.StoreValidResource();
            await SomeoneElseRenames(resource.Id, "Lane");

            // A valid change to the address, saved together with a stale change to the resource.
            address.City = "Tacoma";
            address.RowVersion = 2;
            resource.LastName = "Leigh";
            resource.RowVersion = 2;
            await Assert.ThrowsAsync<ConcurrencyErrorsException>(() => _db.SaveAsync(new SaveBundle()
                .Modify(address, new { City = "Seattle", RowVersion = 1 })
                .Modify(resource, new { LastName = "Lee", RowVersion = 1 })
                .Build()));

            Assert.Equal("Seattle", _db.Load<Address>(address.Id).City);
        }

        /// <summary>Another user's save: loads the resource as it is now, and renames it.</summary>
        private async Task SomeoneElseRenames(Guid resourceId, string lastName)
        {
            var theirs = _db.Load<StaffingResource>(resourceId);
            var loaded = (theirs.LastName, theirs.RowVersion);
            theirs.LastName = lastName;
            theirs.RowVersion = loaded.RowVersion + 1;
            await _db.SaveAsync(new SaveBundle().Modify(theirs, new { loaded.LastName, loaded.RowVersion }).Build());
        }
    }
}
