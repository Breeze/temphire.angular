using Microsoft.EntityFrameworkCore;

namespace TempHire.Model.SampleData
{
    /// <summary>
    /// Ported from <c>DomainServices/SampleData/TempHireSampleDataProvider.cs</c> and
    /// <c>SecuritySampleDataProvider.cs</c>.
    /// <para>
    /// The original implemented Punch's <c>ISampleDataProvider&lt;TempHireEntities&gt;</c> and attached
    /// entities to an in-memory DevForce <c>EntityManager</c> backed by a "fake store".  Breeze has no
    /// such concept - the client always talks to a real server - so the same data is now written to the
    /// database on first run.  The bodies of the entity-building helpers and the data itself are
    /// unchanged, so the app still comes up with the same eight staffing resources.
    /// </para>
    /// </summary>
    public class SampleDataProvider
    {
        // Used for generating sequential Guids, exactly as the original did, so that
        // TempHireSampleDataProvider.CreateGuid(1) still identifies the first resource.
        private int _addressId = 1;
        private int _phoneId = 1;
        private int _rateId = 1;
        private int _resId = 1;
        private int _skillId = 1;
        private int _workId = 1;

        private static readonly DateTime SeedTime = new DateTime(2012, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        /// <summary>Creates the databases if needed and seeds them when they are empty.</summary>
        public static void Initialize(TempHireDbContext context, SecurityDbContext securityContext)
        {
            context.Database.EnsureCreated();
            securityContext.Database.EnsureCreated();

            if (!securityContext.Users.Any())
            {
                // Replaces SecuritySampleDataProvider.  Same credentials as the original: Admin/password.
                securityContext.Users.Add(User.Create("Admin", "password"));
                securityContext.SaveChanges();
            }

            if (context.StaffingResources.Any())
            {
                return;
            }

            new SampleDataProvider().GenerateSampleData(context);
            context.SaveChanges();
        }

        /// <summary>Reproduces the original <c>CreateGuid</c> so seeded ids are stable across runs.</summary>
        public static Guid CreateGuid(int a)
        {
            return new Guid(a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }

        private void GenerateSampleData(TempHireDbContext context)
        {

            var addressTypes = new List<AddressType>
                                   {
                                       new AddressType
                                           {
                                               Id = CreateGuid(1),
                                               Name = "Mailing",
                                               DisplayName = "Mailing Address",
                                               Default = true
                                           },
                                       new AddressType {Id = CreateGuid(2), Name = "Home", DisplayName = "Home Address"},
                                       new AddressType {Id = CreateGuid(3), Name = "Work", DisplayName = "Work Address"}
                                   };
            context.AddRange(addressTypes);

            var phoneTypes = new List<PhoneNumberType>
                                 {
                                     new PhoneNumberType {Id = CreateGuid(1), Name = "Home", Default = true},
                                     new PhoneNumberType {Id = CreateGuid(2), Name = "Work"},
                                     new PhoneNumberType {Id = CreateGuid(3), Name = "Mobile"}
                                 };
            context.AddRange(phoneTypes);

            var rateTypes = new List<RateType>
                                {
                                    new RateType
                                        {Id = CreateGuid(1), Name = "hourly", DisplayName = "Per Hour", Sequence = 0},
                                    new RateType
                                        {Id = CreateGuid(2), Name = "daily", DisplayName = "Per Day", Sequence = 1},
                                    new RateType
                                        {Id = CreateGuid(3), Name = "weekly", DisplayName = "Per Week", Sequence = 2},
                                    new RateType
                                        {
                                            Id = CreateGuid(4),
                                            Name = "monthly",
                                            DisplayName = "Per Month",
                                            Sequence = 3
                                        }
                                };
            context.AddRange(rateTypes);

            var states = new List<State>
                             {
                                 new State {Id = CreateGuid(1), ShortName = "AL", Name = "Alabama"},
                                 new State {Id = CreateGuid(2), ShortName = "AK", Name = "Alaska"},
                                 new State {Id = CreateGuid(3), ShortName = "AZ", Name = "Arizona"},
                                 new State {Id = CreateGuid(4), ShortName = "AR", Name = "Arkansas"},
                                 new State {Id = CreateGuid(5), ShortName = "CA", Name = "California"},
                                 new State {Id = CreateGuid(6), ShortName = "CO", Name = "Colorado"},
                                 new State {Id = CreateGuid(7), ShortName = "CT", Name = "Connecticut"},
                                 new State {Id = CreateGuid(8), ShortName = "DE", Name = "Delaware"},
                                 new State {Id = CreateGuid(9), ShortName = "DC", Name = "District of Columbia"},
                                 new State {Id = CreateGuid(10), ShortName = "FL", Name = "Florida"},
                                 new State {Id = CreateGuid(11), ShortName = "GA", Name = "Georgia"},
                                 new State {Id = CreateGuid(12), ShortName = "HI", Name = "Hawaii"},
                                 new State {Id = CreateGuid(13), ShortName = "ID", Name = "Idaho"},
                                 new State {Id = CreateGuid(14), ShortName = "IL", Name = "Illinois"},
                                 new State {Id = CreateGuid(15), ShortName = "IN", Name = "Indiana"},
                                 new State {Id = CreateGuid(16), ShortName = "IA", Name = "Iowa"},
                                 new State {Id = CreateGuid(17), ShortName = "KS", Name = "Kansas"},
                                 new State {Id = CreateGuid(18), ShortName = "KY", Name = "Kentucky"},
                                 new State {Id = CreateGuid(19), ShortName = "LA", Name = "Louisiana"},
                                 new State {Id = CreateGuid(20), ShortName = "ME", Name = "Maine"},
                                 new State {Id = CreateGuid(21), ShortName = "MD", Name = "Maryland"},
                                 new State {Id = CreateGuid(22), ShortName = "MA", Name = "Massachusetts"},
                                 new State {Id = CreateGuid(23), ShortName = "MI", Name = "Michigan"},
                                 new State {Id = CreateGuid(24), ShortName = "MN", Name = "Minnesota"},
                                 new State {Id = CreateGuid(25), ShortName = "MS", Name = "Mississippi"},
                                 new State {Id = CreateGuid(26), ShortName = "MO", Name = "Missouri"},
                                 new State {Id = CreateGuid(27), ShortName = "MT", Name = "Montana"},
                                 new State {Id = CreateGuid(28), ShortName = "NE", Name = "Nebraska"},
                                 new State {Id = CreateGuid(29), ShortName = "NV", Name = "Nevada"},
                                 new State {Id = CreateGuid(30), ShortName = "NH", Name = "New Hampshire"},
                                 new State {Id = CreateGuid(31), ShortName = "NJ", Name = "New Jersey"},
                                 new State {Id = CreateGuid(32), ShortName = "NM", Name = "New Mexico"},
                                 new State {Id = CreateGuid(33), ShortName = "NY", Name = "New York"},
                                 new State {Id = CreateGuid(34), ShortName = "NC", Name = "North Carolina"},
                                 new State {Id = CreateGuid(35), ShortName = "ND", Name = "North Dakota"},
                                 new State {Id = CreateGuid(36), ShortName = "OH", Name = "Ohio"},
                                 new State {Id = CreateGuid(37), ShortName = "OK", Name = "Oklahoma"},
                                 new State {Id = CreateGuid(38), ShortName = "OR", Name = "Oregon"},
                                 new State {Id = CreateGuid(39), ShortName = "PA", Name = "Pennsylvania"},
                                 new State {Id = CreateGuid(40), ShortName = "RI", Name = "Rhode Island"},
                                 new State {Id = CreateGuid(41), ShortName = "SC", Name = "South Carolina"},
                                 new State {Id = CreateGuid(42), ShortName = "SD", Name = "South Dakota"},
                                 new State {Id = CreateGuid(43), ShortName = "TN", Name = "Tennessee"},
                                 new State {Id = CreateGuid(44), ShortName = "TX", Name = "Texas"},
                                 new State {Id = CreateGuid(45), ShortName = "UT", Name = "Utah"},
                                 new State {Id = CreateGuid(46), ShortName = "VT", Name = "Vermont"},
                                 new State {Id = CreateGuid(47), ShortName = "VA", Name = "Virginia"},
                                 new State {Id = CreateGuid(48), ShortName = "WA", Name = "Washington"},
                                 new State {Id = CreateGuid(49), ShortName = "WV", Name = "West Virginia"},
                                 new State {Id = CreateGuid(50), ShortName = "WI", Name = "Wisconsin"},
                                 new State {Id = CreateGuid(51), ShortName = "WY", Name = "Wyoming"},
                                 new State {Id = CreateGuid(52), ShortName = "--", Name = "International"}
                             };
            context.AddRange(states);

            var r = NewResource("Nancy", "Lynn", "Davolio",
                                     "Education includes a BA in psychology from Colorado State University in 1970.  She also completed \"The Art of the Cold Call.\"  Nancy is a member of Toastmasters International.");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "507 - 20th Ave. E.", "Apt. 2A", "Seattle", states[47],
                                            "98122", true));
            context.Add(NewAddress(r.Id, addressTypes[1], "449 11th Ave W", "Suite 101", "Seattle", states[47], "98123",
                                            false));
            context.Add(NewPhone(r.Id, phoneTypes[0], "206", "555-9857", true));
            context.Add(NewRate(r.Id, rateTypes[0], 100));
            context.Add(NewWork(r.Id, new DateTime(1989, 6, 22), new DateTime(1995, 8, 4), "Concord Catalogs",
                                         "Concord MA", "Sales Representative",
                                         "Tripled sales every three years.  Exceeded sales target every quarter."));
            context.Add(NewWork(r.Id, new DateTime(1995, 8, 5), new DateTime(2000, 2, 14), "Cyberbiz",
                                         "San Francisco CA", "Business Development Executive",
                                         "Targeted clients and found new business through all the sales avenues, including cold calling, email marketing, direct face to face meetings etc."));
            context.Add(NewWork(r.Id, new DateTime(2000, 2, 14), new DateTime(2011, 3, 18), "IIBSIS Global",
                                         "New York NY", "Business Development Sales Executive",
                                         "Sold business intelligence to a wide variety of industry verticals including finance, consulting, accounting, manufacturing."));
            context.Add(NewSkill(r.Id, "Sales"));

            r = NewResource("Andrew", "I", "Fuller",
                            "Andrew received his BTS commercial in 1974 and a Ph.D. in international marketing from the University of Dallas in 1981.  He is fluent in French and Italian and reads German.  He joined the company as a sales representative, was promoted to sales manager in January 1992 and to vice president of sales in March 1993.  Andrew is a member of the Sales Management Roundtable, the Seattle Chamber of Commerce, and the Pacific Rim Importers Association.");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "908 W. Capital Way", "", "Tacoma", states[47], "98401", true));
            context.Add(NewPhone(r.Id, phoneTypes[0], "206", "555-9482", true));
            context.Add(NewPhone(r.Id, phoneTypes[1], "206", "555-0123", false));
            context.Add(NewRate(r.Id, rateTypes[0], 180));
            context.Add(NewRate(r.Id, rateTypes[1], 1000));
            context.Add(NewWork(r.Id, new DateTime(1992, 8, 22), new DateTime(1999, 8, 4), "Famous Footware",
                                         "Lightfoot PA", "Marketing Manager",
                                         "Launched 3 effective campaigns for new products."));
            context.Add(NewWork(r.Id, new DateTime(1999, 8, 5), new DateTime(2002, 6, 1), "Logorific",
                                         "Grand Rapids, MI", "Sales & Marketing Account Executive",
                                         "Worked with local chambers of commerce and town halls to set up a distribution point for marketing materials."));
            context.Add(NewWork(r.Id, new DateTime(2002, 6, 2), new DateTime(2011, 9, 5), "Start This",
                                         "Palo Alto CA", "Head of Marketing",
                                         "Built and executed marketing and PR strategy from scratch, including positioning, brand identity, pricing and product definition."));
            context.Add(NewSkill(r.Id, "Sales"));
            context.Add(NewSkill(r.Id, "Marketing"));

            r = NewResource("Janet", "N", "Leverling",
                            "Janet has a BS degree in chemistry from Boston College (1984).  She has also completed a certificate program in food retailing management.  Janet was hired as a sales associate in 1991 and promoted to sales representative in February 1992.");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "722 Moss Bay Blvd.", "", "Kirkland", states[47], "98033",
                                            true));
            context.Add(NewPhone(r.Id, phoneTypes[0], "206", "555-3412", true));
            context.Add(NewPhone(r.Id, phoneTypes[1], "206", "555-3355", false));
            context.Add(NewRate(r.Id, rateTypes[0], 50));
            context.Add(NewRate(r.Id, rateTypes[1], 300));
            context.Add(NewWork(r.Id, new DateTime(1992, 4, 1), new DateTime(1998, 3, 1), "Hobson Foods",
                                         "Tacoma WA", "Junior Chemist",
                                         "Developed new food additives.  Was banned from employeed cafeteria."));
            context.Add(NewWork(r.Id, new DateTime(1998, 3, 2), new DateTime(1995, 8, 4), "Pharmabiz",
                                         "Wilmington NC", "Chemist",
                                         "Responsible for validation of analytical methods and testing in support of pharmaceutical product development."));
            context.Add(NewWork(r.Id, new DateTime(1995, 8, 4), new DateTime(2009, 12, 21), "Colaca",
                                         "Point Comfort TX", "Senior Chemist",
                                         "Provided technical analytical support to the laboratory for day-to-day operations and long term technical advancement of the department."));
            context.Add(NewSkill(r.Id, "Sales"));
            context.Add(NewSkill(r.Id, "Chemistry"));

            r = NewResource("Margaret", "G", "Peacock",
                            "Margaret holds a BA in English literature from Concordia College (1958) and an MA from the American Institute of Culinary Arts (1966).  She was assigned to the London office temporarily from July through November 1992.");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "4110 Old Redmond Rd.", "", "Redmond", states[47], "98052",
                                            true));
            context.Add(NewPhone(r.Id, phoneTypes[0], "206", "555-8122", true));
            context.Add(NewPhone(r.Id, phoneTypes[1], "206", "555-5176", false));
            context.Add(NewRate(r.Id, rateTypes[0], 50));
            context.Add(NewRate(r.Id, rateTypes[1], 300));
            context.Add(NewWork(r.Id, new DateTime(1993, 5, 3), new DateTime(1998, 3, 1), "Sylvan Software",
                                         "Tacoma WA", "Developer",
                                         "Co-developed internal database system.  Put all data in a single table to conserve space."));
            context.Add(NewWork(r.Id, new DateTime(1998, 3, 2), new DateTime(2008, 5, 5), "Big Man Industries",
                                         "Champaign IL", "Developer", "Silverlight and web applications."));
            context.Add(NewSkill(r.Id, "C++"));


            context.Add(NewSkill(r.Id, "SQL"));

            r = NewResource("Steven", "T", "Buchanan",
                            "Steven Buchanan graduated from St. Andrews University, Scotland, with a BSC degree in 1976.  Upon joining the company as a sales representative in 1992, he spent 6 months in an orientation program at the Seattle office and then returned to his permanent post in London.  He was promoted to sales manager in March 1993.  Mr. Buchanan has completed the courses \"Successful Telemarketing\" and \"International Sales Management.\"  He is fluent in French.");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "14 Garrett Hill", "", "London", states[51], "SW1 8JR", true));
            context.Add(NewPhone(r.Id, phoneTypes[0], "071", "555-4848", true));
            context.Add(NewPhone(r.Id, phoneTypes[1], "071", "555-3453", false));
            context.Add(NewRate(r.Id, rateTypes[0], 50));
            context.Add(NewRate(r.Id, rateTypes[1], 300));
            context.Add(NewRate(r.Id, rateTypes[2], 1500));
            context.Add(NewRate(r.Id, rateTypes[2], 6000));
            context.Add(NewWork(r.Id, new DateTime(1989, 6, 22), new DateTime(1995, 8, 4), "AeroDef Sales",
                                         "Virginia Beach VA", "Vertical Sales Manager, Army East",
                                         "Developed business relationships with key decision makers at the Command, Division, Brigade, etc. levels."));
            context.Add(NewWork(r.Id, new DateTime(1995, 8, 4), new DateTime(2002, 2, 6), "FireControl",
                                         "Tampa FL", "Residential Sales Manager",
                                         "Implemented new sales techniques to increase business in new territory"));

            r = NewResource("Michael", "", "Suyama",
                            "Michael is a graduate of Sussex University (MA, economics, 1983) and the University of California at Los Angeles (MBA, marketing, 1986).  He has also taken the courses \"Multi-Cultural Selling\" and \"Time Management for the Sales Professional.\"  He is fluent in Japanese and can read and write French, Portuguese, and Spanish.");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "Coventry House  Miner Rd.", "", "London", states[51],
                                            "EC2 7JR", true));
            context.Add(NewPhone(r.Id, phoneTypes[0], "071", "555-7773", true));
            context.Add(NewPhone(r.Id, phoneTypes[1], "071", "555-0428", false));
            context.Add(NewWork(r.Id, new DateTime(1989, 6, 22), new DateTime(1994, 1, 1), "Rainout",
                                         "Oakland CA", "CRM Analyst",
                                         "Responsible for all aspects of CRM business management and marketing development."));
            context.Add(NewWork(r.Id, new DateTime(1995, 1, 2), new DateTime(2005, 10, 30), "Planatele",
                                         "Chicago IL", "Field Sales Account Manager",
                                         "Expanded account penetration by increasing share of total year over year spend."));

            r = NewResource("Laura", "A", "Callahan",
                            "Laura received a BA in psychology from the University of Washington.  She has also completed a course in business French.  She reads and writes French.");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "4726 - 11th Ave. N.E.", "", "Seattle", states[47], "98105",
                                            true));
            context.Add(NewPhone(r.Id, phoneTypes[0], "206", "555-1189", true));
            context.Add(NewPhone(r.Id, phoneTypes[1], "206", "555-2344", false));
            context.Add(NewWork(r.Id, new DateTime(1989, 6, 22), new DateTime(1995, 8, 4), "Careste",
                                         "Fort Lauderdale FL", "Sales Development Associate",
                                         "Soliciting accounts and contacting existing customers to promote sales."));
            context.Add(NewWork(r.Id, new DateTime(2002, 2, 18), new DateTime(2009, 12, 24), "Silent Hill",
                                         "Atlanta GA", "Legal eagle",
                                         "Passion for innovation, creativity and continuous improvement."));

            r = NewResource("Anne", "F", "Dodsworth",
                            "Anne has a BA degree in English from St. Lawrence College.  She is fluent in French and German.");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "7 Houndstooth Rd.", "", "London", states[51], "WG2 7LT",
                                            true));
            context.Add(NewPhone(r.Id, phoneTypes[0], "071", "555-4444", true));
            context.Add(NewPhone(r.Id, phoneTypes[1], "071", "555-0452", false));
            context.Add(NewWork(r.Id, new DateTime(1989, 6, 22), new DateTime(1995, 8, 4), "TigerGate",
                                         "Bellvue WA", "Editorial Program Manager",
                                         "Defined guidelines and policies for the landing page content selection and promotion."));
            context.Add(NewWork(r.Id, new DateTime(1999, 3, 21), new DateTime(2011, 6, 1), "ProTrans",
                                         "Coral Gables FL", "Linguistic Coder",
                                         "Liaison between the developers and the client. Helps communicate thoughts and ideas into values which are structured and analyzed."));

            r = NewResource("Pearl", "P", "Pindlegrass",
                            "Holds the MA degree in Education from UC Berkeley");
            context.Add(r);
            context.Add(NewAddress(r.Id, addressTypes[0], "18233 N.Wunderkindt", "", "Munich", states[35], "32382",
                                            true));
            context.Add(NewPhone(r.Id, phoneTypes[0], "382", "293-2938", true));
            context.Add(NewPhone(r.Id, phoneTypes[1], "382", "555-2938", false));
            context.Add(NewWork(r.Id, new DateTime(1989, 6, 22), new DateTime(1995, 8, 4),
                                         "Reynolds School District", "Grenville PA", "German Teacher",
                                         "Pennsylvania Foreign Language (German) Teacher Certification"));
            context.Add(NewWork(r.Id, new DateTime(1996, 9, 1), new DateTime(1997, 6, 16), "Phillips Academy",
                                         "Andover MA", "Visiting Scholar", "One-year teaching fellowship."));
            context.Add(NewWork(r.Id, new DateTime(1989, 6, 22), new DateTime(1995, 8, 4), "TeachCo",
                                         "New Rochelle NY", "Special Educator", "NYS Certified"));
        
        }

        #region methods for building entities with sample data

        private StaffingResource NewResource(string first, string middle, string last, string summary)
        {
            return new StaffingResource
            {
                Id = CreateGuid(_resId++),
                FirstName = first,
                MiddleName = middle,
                LastName = last,
                Summary = summary,
                Created = SeedTime,
                CreatedUser = "SampleData",
                Modified = SeedTime,
                ModifyUser = "SampleData"
            };
        }

        private Address NewAddress(Guid resid, AddressType type, string address1, string address2, string city,
                                   State state, string zip, bool primary)
        {
            return new Address
            {
                Id = CreateGuid(_addressId++),
                AddressTypeId = type.Id,
                Address1 = address1,
                Address2 = address2,
                City = city,
                StateId = state.Id,
                Zipcode = zip,
                StaffingResourceId = resid,
                Primary = primary,
                Created = SeedTime,
                CreatedUser = "SampleData",
                Modified = SeedTime,
                ModifyUser = "SampleData"
            };
        }

        private PhoneNumber NewPhone(Guid resid, PhoneNumberType type, string areaCode, string phone, bool primary)
        {
            return new PhoneNumber
            {
                Id = CreateGuid(_phoneId++),
                PhoneNumberTypeId = type.Id,
                AreaCode = areaCode,
                Number = phone,
                StaffingResourceId = resid,
                Primary = primary,
                Created = SeedTime,
                CreatedUser = "SampleData",
                Modified = SeedTime,
                ModifyUser = "SampleData"
            };
        }

        private Rate NewRate(Guid resid, RateType type, decimal amount)
        {
            return new Rate
            {
                Id = CreateGuid(_rateId++),
                RateTypeId = type.Id,
                Amount = amount,
                StaffingResourceId = resid,
                Created = SeedTime,
                CreatedUser = "SampleData",
                Modified = SeedTime,
                ModifyUser = "SampleData"
            };
        }

        private WorkExperienceItem NewWork(Guid resid, DateTime from, DateTime to, string company, string location,
                                           string title, string description)
        {
            return new WorkExperienceItem
            {
                Id = CreateGuid(_workId++),
                StaffingResourceId = resid,
                From = from,
                To = to,
                Company = company,
                Location = location,
                PositionTitle = title,
                Description = description,
                Created = SeedTime,
                CreatedUser = "SampleData",
                Modified = SeedTime,
                ModifyUser = "SampleData"
            };
        }

        private Skill NewSkill(Guid resid, string desc)
        {
            return new Skill
            {
                Id = CreateGuid(_skillId++),
                Description = desc,
                StaffingResourceId = resid,
                Created = SeedTime,
                CreatedUser = "SampleData",
                Modified = SeedTime,
                ModifyUser = "SampleData"
            };
        }

        #endregion
    }
}
