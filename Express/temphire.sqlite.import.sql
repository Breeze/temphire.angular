-- Script Date: 9/15/2016 11:51 PM  - ErikEJ.SqlCeScripting version 3.5.2.58
-- Database information:
-- Locale Identifier: 1033
-- Encryption Mode: 
-- Case Sensitive: False
-- Database: C:\git\Breeze\temphire.angular2\TempHire\App_Data\TempHire.temp.sdf
-- ServerVersion: 4.0.8876.1
-- DatabaseSize: 384 KB
-- SpaceAvailable: 3.999 GB
-- Created: 9/15/2016 2:58 PM

-- User Table information:
-- Number of tables: 11
-- __MigrationHistory: 1 row(s)
-- Addresses: 10 row(s)
-- AddressTypes: 3 row(s)
-- PhoneNumbers: 17 row(s)
-- PhoneNumberTypes: 3 row(s)
-- Rates: 11 row(s)
-- RateTypes: 4 row(s)
-- Skills: 7 row(s)
-- StaffingResources: 9 row(s)
-- States: 52 row(s)
-- WorkExperienceItems: 22 row(s)

SELECT 1;
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE [States] (
  [Id] uniqueidentifier NOT NULL
, [ShortName] nvarchar(2) NOT NULL
, [Name] nvarchar(4000) NOT NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.States] PRIMARY KEY ([Id])
);
CREATE TABLE [StaffingResources] (
  [Id] uniqueidentifier NOT NULL
, [FirstName] nvarchar(4000) NOT NULL
, [MiddleName] nvarchar(4000) NULL
, [LastName] nvarchar(4000) NOT NULL
, [Summary] nvarchar(4000) NOT NULL
, [Created] datetime NOT NULL
, [CreatedUser] nvarchar(4000) NULL
, [Modified] datetime NOT NULL
, [ModifyUser] nvarchar(4000) NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.StaffingResources] PRIMARY KEY ([Id])
);
CREATE TABLE [WorkExperienceItems] (
  [Id] uniqueidentifier NOT NULL
, [From] datetime NOT NULL
, [To] datetime NOT NULL
, [PositionTitle] nvarchar(4000) NOT NULL
, [Company] nvarchar(4000) NOT NULL
, [Location] nvarchar(4000) NOT NULL
, [Description] nvarchar(4000) NOT NULL
, [StaffingResourceId] uniqueidentifier NOT NULL
, [Created] datetime NOT NULL
, [CreatedUser] nvarchar(4000) NULL
, [Modified] datetime NOT NULL
, [ModifyUser] nvarchar(4000) NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.WorkExperienceItems] PRIMARY KEY ([Id])
, FOREIGN KEY ([StaffingResourceId]) REFERENCES [StaffingResources] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE [Skills] (
  [Id] uniqueidentifier NOT NULL
, [Description] nvarchar(4000) NOT NULL
, [StaffingResourceId] uniqueidentifier NOT NULL
, [Created] datetime NOT NULL
, [CreatedUser] nvarchar(4000) NULL
, [Modified] datetime NOT NULL
, [ModifyUser] nvarchar(4000) NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.Skills] PRIMARY KEY ([Id])
, FOREIGN KEY ([StaffingResourceId]) REFERENCES [StaffingResources] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE [RateTypes] (
  [Id] uniqueidentifier NOT NULL
, [Name] nvarchar(4000) NOT NULL
, [DisplayName] nvarchar(4000) NOT NULL
, [Sequence] smallint NOT NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.RateTypes] PRIMARY KEY ([Id])
);
CREATE TABLE [Rates] (
  [Id] uniqueidentifier NOT NULL
, [Amount] numeric(18,2) NOT NULL
, [RateTypeId] uniqueidentifier NOT NULL
, [StaffingResourceId] uniqueidentifier NOT NULL
, [Created] datetime NOT NULL
, [CreatedUser] nvarchar(4000) NULL
, [Modified] datetime NOT NULL
, [ModifyUser] nvarchar(4000) NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.Rates] PRIMARY KEY ([Id])
, FOREIGN KEY ([RateTypeId]) REFERENCES [RateTypes] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
, FOREIGN KEY ([StaffingResourceId]) REFERENCES [StaffingResources] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE [PhoneNumberTypes] (
  [Id] uniqueidentifier NOT NULL
, [Name] nvarchar(4000) NOT NULL
, [Default] bit NOT NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.PhoneNumberTypes] PRIMARY KEY ([Id])
);
CREATE TABLE [PhoneNumbers] (
  [Id] uniqueidentifier NOT NULL
, [AreaCode] nvarchar(3) NOT NULL
, [Number] nvarchar(8) NOT NULL
, [PhoneNumberTypeId] uniqueidentifier NOT NULL
, [StaffingResourceId] uniqueidentifier NOT NULL
, [Primary] bit NOT NULL
, [Created] datetime NOT NULL
, [CreatedUser] nvarchar(4000) NULL
, [Modified] datetime NOT NULL
, [ModifyUser] nvarchar(4000) NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.PhoneNumbers] PRIMARY KEY ([Id])
, FOREIGN KEY ([PhoneNumberTypeId]) REFERENCES [PhoneNumberTypes] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
, FOREIGN KEY ([StaffingResourceId]) REFERENCES [StaffingResources] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE TABLE [AddressTypes] (
  [Id] uniqueidentifier NOT NULL
, [Name] nvarchar(4000) NOT NULL
, [DisplayName] nvarchar(4000) NOT NULL
, [Default] bit NOT NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.AddressTypes] PRIMARY KEY ([Id])
);
CREATE TABLE [Addresses] (
  [Id] uniqueidentifier NOT NULL
, [Address1] nvarchar(4000) NOT NULL
, [Address2] nvarchar(4000) NULL
, [City] nvarchar(4000) NOT NULL
, [StaffingResourceId] uniqueidentifier NOT NULL
, [AddressTypeId] uniqueidentifier NOT NULL
, [Zipcode] nvarchar(10) NOT NULL
, [Primary] bit NOT NULL
, [StateId] uniqueidentifier NOT NULL
, [Created] datetime NOT NULL
, [CreatedUser] nvarchar(4000) NULL
, [Modified] datetime NOT NULL
, [ModifyUser] nvarchar(4000) NULL
, [RowVersion] int NOT NULL
, CONSTRAINT [PK_dbo.Addresses] PRIMARY KEY ([Id])
, FOREIGN KEY ([AddressTypeId]) REFERENCES [AddressTypes] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
, FOREIGN KEY ([StaffingResourceId]) REFERENCES [StaffingResources] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
, FOREIGN KEY ([StateId]) REFERENCES [States] ([Id]) ON DELETE CASCADE ON UPDATE NO ACTION
);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'a787e856-d5dc-4db6-a0c6-0382653def0b','MO','Missouri',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'd5eed47d-a6a5-4bde-9d7d-03c1fd649d8c','--','International',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'ae7c8bd7-3fc7-43c6-9f37-07b6c478de7b','RI','Rhode Island',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'49d003b4-a96a-4325-a9ed-1105be442890','SC','South Carolina',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'4e6634b9-3065-4522-9ab6-1bcb14a7a8e0','WA','Washington',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'fd9e3881-3240-4e5a-9e06-1fe63f2d6a4b','IA','Iowa',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'17b03c29-0727-42a4-bad1-21936a5e1f2f','NC','North Carolina',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'78b64e5a-566a-44f9-b149-2817c91652f3','CA','California',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'd0beea81-bcdb-490f-934e-2f8295d05baa','AK','Alaska',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'cef92aec-8c4d-4fd4-9909-34187eee2f6d','PA','Pennsylvania',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'75a3a98d-2985-4df3-a69c-36521fb9d90f','HI','Hawaii',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'e27bd500-df38-4d30-98da-3fd5ced252da','MD','Maryland',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'04900232-d67f-42b0-8ce7-46e05a19557b','ME','Maine',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'533625e4-c47c-442b-bbb1-4f77480b3bda','WV','West Virginia',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'aeeeae29-fbfa-4052-8d8f-5c02a6eeedfd','CO','Colorado',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'80ec1d46-0244-4586-93ca-6014b6e17516','KS','Kansas',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'99c9dd19-b687-495d-ae43-632dfe9832d4','IL','Illinois',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'4f6b0d88-7556-4cec-82dd-654efaebd1ea','OK','Oklahoma',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'dcf79e56-6294-4915-a1a5-669bacb17d52','KY','Kentucky',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'016a09cf-464a-4963-97c9-68ce6a704c22','AZ','Arizona',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'2f8ac193-f700-4268-8c68-7489bd11d254','AR','Arkansas',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'ae1bb64b-b354-4ce8-9c77-775362515924','WY','Wyoming',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'63c6aced-0f58-42fc-b711-811b61746626','AL','Alabama',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'e2f48677-982b-4d48-a333-834af28e8e4d','FL','Florida',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'db0e6eb8-e0cd-4a06-a209-8a2c45dcf9c2','MT','Montana',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'5e23bad7-755b-415d-9aca-8acbe87c1da8','OH','Ohio',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'f892d1a9-582a-483e-a937-8b360a271167','DE','Delaware',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'2c8e4741-15a0-4384-86d1-945e3d9901d9','SD','South Dakota',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'67057428-beb8-49c7-b0c2-94c1f90e18d7','TN','Tennessee',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'7c57f382-0c74-4147-9867-971e9b0debf8','NM','New Mexico',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'143943a0-bab4-4228-9534-9da509410dfe','NE','Nebraska',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'b54518d0-ba89-4ef4-813d-9e0678846f33','IN','Indiana',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'bd21f05e-2e11-4f50-a8c1-a220715a1822','NV','Nevada',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'4829e5d2-a862-4c12-b960-a51e7d1b594e','NY','New York',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'4bdf22ac-60ef-4ef3-bb89-acbf67b84d92','ND','North Dakota',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'd9ac582b-6497-4fdb-96d7-acdc05e49dc0','MS','Mississippi',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'526b865c-2e32-4cb4-ba74-b4bc9b171534','LA','Louisiana',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'db103346-338b-4792-8a5a-b56ab5b5b41b','GA','Georgia',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'23876d46-4be0-4a50-bdf5-b69c865f2409','VT','Vermont',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'85725bac-9950-4d11-98e0-b77418c7c383','UT','Utah',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'81b24e05-9fcb-4188-8501-bc937a3b62b2','NH','New Hampshire',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'617c8a1f-7219-4ec0-81e5-bd950a33bff3','DC','District of Columbia',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'3500056b-ee55-4fb9-936e-c2f852e57ceb','CT','Connecticut',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'5521ae5e-88ed-4c86-92a3-cc3d3fc8ef2e','MI','Michigan',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'6fe10f05-9e69-49d0-87f6-cd6027ddbf5d','ID','Idaho',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'3cedadd7-e84a-4a97-97e6-d011ea87ac95','MA','Massachusetts',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'c3088233-ce6d-4e75-b03a-d4e5a64640e4','TX','Texas',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'bd4b32b8-8efd-4ca3-b3e6-d7e23f21f34c','VA','Virginia',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'952f0823-9ecc-4125-9883-d94f18a216ab','OR','Oregon',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'97ab7473-c29c-4a07-9d94-db08ae2dd6a5','NJ','New Jersey',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'922a3ba2-8d6f-46dd-b321-de7b97ef509d','WI','Wisconsin',0);
INSERT INTO [States] ([Id],[ShortName],[Name],[RowVersion]) VALUES (
'b285a4a1-6ace-420b-8c89-ead26fd6310d','MN','Minnesota',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'ab32efb3-3379-4a5d-8aca-5159bd911549','Nancy','Lynn','Davolio','Education includes a BA in psychology from Colorado State University in 1970.  She also completed "The Art of the Cold Call."  Nancy is a member of Toastmasters International.','2016-09-15 14:58:38.207','SampleData','2016-09-15 14:58:38.207','SampleData',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'fe9577de-f199-44ae-bce3-600277e4f4b8','Margaret','G','Peacock','Margaret holds a BA in English literature from Concordia College (1958) and an MA from the American Institute of Culinary Arts (1966).  She was assigned to the London office temporarily from July through November 1992.','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'1ff8cc80-89df-416c-a716-6e7bb90b274a','Steven','T','Buchanan','Steven Buchanan graduated from St. Andrews University, Scotland, with a BSC degree in 1976.  Upon joining the company as a sales representative in 1992, he spent 6 months in an orientation program at the Seattle office and then returned to his permanent post in London.  He was promoted to sales manager in March 1993.  Mr. Buchanan has completed the courses "Successful Telemarketing" and "International Sales Management."  He is fluent in French.','2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'dfcd4313-4979-40af-9023-7e0ebede326a','Pearl','P','Pindlegrass','Holds the MA degree in Education from UC Berkeley','2016-09-15 14:58:38.240','SampleData','2016-09-15 14:58:38.240','SampleData',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'75eeb1fb-6da6-4117-8bfa-874f371e6e88','Anne','F','Dodsworth','Anne has a BA degree in English from St. Lawrence College.  She is fluent in French and German.','2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'd80153c7-21c8-4de1-85ce-af2504a7ea4b','Michael','','Suyama','Michael is a graduate of Sussex University (MA, economics, 1983) and the University of California at Los Angeles (MBA, marketing, 1986).  He has also taken the courses "Multi-Cultural Selling" and "Time Management for the Sales Professional."  He is fluent in Japanese and can read and write French, Portuguese, and Spanish.','2016-09-15 14:58:38.233','SampleData','2016-09-15 14:58:38.233','SampleData',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','Janet','N','Leverling','Janet has a BS degree in chemistry from Boston College (1984).  She has also completed a certificate program in food retailing management.  Janet was hired as a sales associate in 1991 and promoted to sales representative in February 1992.','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'9332040c-7103-4ef8-8ebb-ef89c46fa089','Andrew','I','Fuller','Andrew received his BTS commercial in 1974 and a Ph.D. in international marketing from the University of Dallas in 1981.  He is fluent in French and Italian and reads German.  He joined the company as a sales representative, was promoted to sales manager in January 1992 and to vice president of sales in March 1993.  Andrew is a member of the Sales Management Roundtable, the Seattle Chamber of Commerce, and the Pacific Rim Importers Association.','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [StaffingResources] ([Id],[FirstName],[MiddleName],[LastName],[Summary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'c5e986b1-ac09-4ccc-94db-f8a302bfbda2','Laura','A','Callahan','Laura received a BA in psychology from the University of Washington.  She has also completed a course in business French.  She reads and writes French.','2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'5f61171e-b347-4a14-8838-11b0ba8cc635','1998-03-02 00:00:00.000','2008-05-05 00:00:00.000','Developer','Big Man Industries','Champaign IL','Silverlight and web applications.','fe9577de-f199-44ae-bce3-600277e4f4b8','2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'2b11adc9-5a50-4371-a69b-217cab0fc4c0','1996-09-01 00:00:00.000','1997-06-16 00:00:00.000','Visiting Scholar','Phillips Academy','Andover MA','One-year teaching fellowship.','dfcd4313-4979-40af-9023-7e0ebede326a','2016-09-15 14:58:38.243','SampleData','2016-09-15 14:58:38.243','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'4f11d5a0-4b25-4d65-bc3d-35285c1c93f4','2002-06-02 00:00:00.000','2011-09-05 00:00:00.000','Head of Marketing','Start This','Palo Alto CA','Built and executed marketing and PR strategy from scratch, including positioning, brand identity, pricing and product definition.','9332040c-7103-4ef8-8ebb-ef89c46fa089','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'da9d36cf-2126-4999-a492-4b41acd75ea4','1992-08-22 00:00:00.000','1999-08-04 00:00:00.000','Marketing Manager','Famous Footware','Lightfoot PA','Launched 3 effective campaigns for new products.','9332040c-7103-4ef8-8ebb-ef89c46fa089','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'706a8d15-d687-4774-97d9-4dabf35a113b','1995-01-02 00:00:00.000','2005-10-30 00:00:00.000','Field Sales Account Manager','Planatele','Chicago IL','Expanded account penetration by increasing share of total year over year spend.','d80153c7-21c8-4de1-85ce-af2504a7ea4b','2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'5e852810-9a0d-4b19-9257-5242d2c5f0ce','1989-06-22 00:00:00.000','1995-08-04 00:00:00.000','Vertical Sales Manager, Army East','AeroDef Sales','Virginia Beach VA','Developed business relationships with key decision makers at the Command, Division, Brigade, etc. levels.','1ff8cc80-89df-416c-a716-6e7bb90b274a','2016-09-15 14:58:38.233','SampleData','2016-09-15 14:58:38.233','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'aed0b7f5-0f55-46c6-8cfd-53491d11367d','2002-02-18 00:00:00.000','2009-12-24 00:00:00.000','Legal eagle','Silent Hill','Atlanta GA','Passion for innovation, creativity and continuous improvement.','c5e986b1-ac09-4ccc-94db-f8a302bfbda2','2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'0fb47eec-9ce9-42b5-8c22-5c7cd687aa98','1995-08-05 00:00:00.000','2000-02-14 00:00:00.000','Business Development Executive','Cyberbiz','San Francisco CA','Targeted clients and found new business through all the sales avenues, including cold calling, email marketing, direct face to face meetings etc.','ab32efb3-3379-4a5d-8aca-5159bd911549','2016-09-15 14:58:38.220','SampleData','2016-09-15 14:58:38.220','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'b00f2270-fe10-45e8-8933-6c6dff63d2c8','1995-08-04 00:00:00.000','2002-02-06 00:00:00.000','Residential Sales Manager','FireControl','Tampa FL','Implemented new sales techniques to increase business in new territory','1ff8cc80-89df-416c-a716-6e7bb90b274a','2016-09-15 14:58:38.233','SampleData','2016-09-15 14:58:38.233','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'40f07e67-5cda-45cd-96a4-763812ab968b','1992-04-01 00:00:00.000','1998-03-01 00:00:00.000','Junior Chemist','Hobson Foods','Tacoma WA','Developed new food additives.  Was banned from employeed cafeteria.','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'5f33c2c9-8e68-448a-aed5-8be16cf51748','1999-03-21 00:00:00.000','2011-06-01 00:00:00.000','Linguistic Coder','ProTrans','Coral Gables FL','Liaison between the developers and the client. Helps communicate thoughts and ideas into values which are structured and analyzed.','75eeb1fb-6da6-4117-8bfa-874f371e6e88','2016-09-15 14:58:38.240','SampleData','2016-09-15 14:58:38.240','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'04f02cbb-8e2b-45d9-a3eb-9033b42587f3','2000-02-14 00:00:00.000','2011-03-18 00:00:00.000','Business Development Sales Executive','IIBSIS Global','New York NY','Sold business intelligence to a wide variety of industry verticals including finance, consulting, accounting, manufacturing.','ab32efb3-3379-4a5d-8aca-5159bd911549','2016-09-15 14:58:38.220','SampleData','2016-09-15 14:58:38.220','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'9f095722-ec7f-4746-83e0-92fb6d1bd001','1999-08-05 00:00:00.000','2002-06-01 00:00:00.000','Sales & Marketing Account Executive','Logorific','Grand Rapids, MI','Worked with local chambers of commerce and town halls to set up a distribution point for marketing materials.','9332040c-7103-4ef8-8ebb-ef89c46fa089','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'999593dc-8040-47da-8844-960233b32423','1989-06-22 00:00:00.000','1995-08-04 00:00:00.000','Special Educator','TeachCo','New Rochelle NY','NYS Certified','dfcd4313-4979-40af-9023-7e0ebede326a','2016-09-15 14:58:38.243','SampleData','2016-09-15 14:58:38.243','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'f0090fac-a161-42c2-949d-97c462ed4f31','1995-08-04 00:00:00.000','2009-12-21 00:00:00.000','Senior Chemist','Colaca','Point Comfort TX','Provided technical analytical support to the laboratory for day-to-day operations and long term technical advancement of the department.','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'822b4b0a-4a95-49e1-8c7a-d67a7dc0c0a4','1989-06-22 00:00:00.000','1994-01-01 00:00:00.000','CRM Analyst','Rainout','Oakland CA','Responsible for all aspects of CRM business management and marketing development.','d80153c7-21c8-4de1-85ce-af2504a7ea4b','2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'85c0641c-5787-4228-9f6d-d73cb4e25c4f','1989-06-22 00:00:00.000','1995-08-04 00:00:00.000','Sales Development Associate','Careste','Fort Lauderdale FL','Soliciting accounts and contacting existing customers to promote sales.','c5e986b1-ac09-4ccc-94db-f8a302bfbda2','2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'cd6b190f-10dc-49da-b94b-dbaba83c803b','1989-06-22 00:00:00.000','1995-08-04 00:00:00.000','German Teacher','Reynolds School District','Grenville PA','Pennsylvania Foreign Language (German) Teacher Certification','dfcd4313-4979-40af-9023-7e0ebede326a','2016-09-15 14:58:38.243','SampleData','2016-09-15 14:58:38.243','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'73649ed4-3c76-48a6-83bd-df05a9a59884','1989-06-22 00:00:00.000','1995-08-04 00:00:00.000','Editorial Program Manager','TigerGate','Bellvue WA','Defined guidelines and policies for the landing page content selection and promotion.','75eeb1fb-6da6-4117-8bfa-874f371e6e88','2016-09-15 14:58:38.240','SampleData','2016-09-15 14:58:38.240','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'ed340378-3c82-430b-ae0f-eea9655b7c60','1998-03-02 00:00:00.000','1995-08-04 00:00:00.000','Chemist','Pharmabiz','Wilmington NC','Responsible for validation of analytical methods and testing in support of pharmaceutical product development.','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'677d4290-9c4d-49a4-9377-f375b49761e4','1993-05-03 00:00:00.000','1998-03-01 00:00:00.000','Developer','Sylvan Software','Tacoma WA','Co-developed internal database system.  Put all data in a single table to conserve space.','fe9577de-f199-44ae-bce3-600277e4f4b8','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [WorkExperienceItems] ([Id],[From],[To],[PositionTitle],[Company],[Location],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'df4c54ac-207f-471e-81da-fb7a43cc649e','1989-06-22 00:00:00.000','1995-08-04 00:00:00.000','Sales Representative','Concord Catalogs','Concord MA','Tripled sales every three years.  Exceeded sales target every quarter.','ab32efb3-3379-4a5d-8aca-5159bd911549','2016-09-15 14:58:38.217','SampleData','2016-09-15 14:58:38.217','SampleData',0);
INSERT INTO [Skills] ([Id],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'15d3d93a-ec5f-4542-9001-02938f0eed68','Marketing','9332040c-7103-4ef8-8ebb-ef89c46fa089','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [Skills] ([Id],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'3c31fd6b-384d-40df-8982-0522a626a185','Sales','ab32efb3-3379-4a5d-8aca-5159bd911549','2016-09-15 14:58:38.220','SampleData','2016-09-15 14:58:38.220','SampleData',0);
INSERT INTO [Skills] ([Id],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'c9ebfd8e-0254-4736-828f-1210dcb37d98','C++','fe9577de-f199-44ae-bce3-600277e4f4b8','2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [Skills] ([Id],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'3ac7bb34-12d6-4f6a-bed4-232890745ff5','Sales','9332040c-7103-4ef8-8ebb-ef89c46fa089','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [Skills] ([Id],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'8629116e-88b7-48ef-a803-62f9ea3c92a8','Sales','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [Skills] ([Id],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'ba9cc3d5-483e-4165-b4a3-7dfa7a83c258','SQL','fe9577de-f199-44ae-bce3-600277e4f4b8','2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [Skills] ([Id],[Description],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'c98d7e88-9234-4a47-908b-eda427b10d23','Chemistry','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [RateTypes] ([Id],[Name],[DisplayName],[Sequence],[RowVersion]) VALUES (
'12dc9db3-3d2e-4172-81b2-a0f806751db6','monthly','Per Month',3,0);
INSERT INTO [RateTypes] ([Id],[Name],[DisplayName],[Sequence],[RowVersion]) VALUES (
'81a07752-af84-4c7d-a875-c337d7ccaa05','hourly','Per Hour',0,0);
INSERT INTO [RateTypes] ([Id],[Name],[DisplayName],[Sequence],[RowVersion]) VALUES (
'f0f3dc00-49b2-4450-8835-c5d42ef5c0ba','daily','Per Day',1,0);
INSERT INTO [RateTypes] ([Id],[Name],[DisplayName],[Sequence],[RowVersion]) VALUES (
'e61065f5-2a00-4465-b4f5-f2eb54713313','weekly','Per Week',2,0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'53db8ffc-8145-446a-9c45-12e20b537993',50.00,'81a07752-af84-4c7d-a875-c337d7ccaa05','fe9577de-f199-44ae-bce3-600277e4f4b8','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'79a1bb16-3409-4e06-a957-2ec59f43c988',50.00,'81a07752-af84-4c7d-a875-c337d7ccaa05','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'b3878804-3eca-4ab2-8c9c-3a5e99140d41',1000.00,'f0f3dc00-49b2-4450-8835-c5d42ef5c0ba','9332040c-7103-4ef8-8ebb-ef89c46fa089','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'dc98feed-feae-4e44-9e44-7784b9126946',300.00,'f0f3dc00-49b2-4450-8835-c5d42ef5c0ba','1ff8cc80-89df-416c-a716-6e7bb90b274a','2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'7462de98-61a0-4896-99ae-7ac51c649af4',100.00,'81a07752-af84-4c7d-a875-c337d7ccaa05','ab32efb3-3379-4a5d-8aca-5159bd911549','2016-09-15 14:58:38.217','SampleData','2016-09-15 14:58:38.217','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'9cdf5902-c513-45c5-8922-7b4c072eed68',300.00,'f0f3dc00-49b2-4450-8835-c5d42ef5c0ba','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'cfed18ae-5882-44dd-9e96-92959c5aeaa2',6000.00,'e61065f5-2a00-4465-b4f5-f2eb54713313','1ff8cc80-89df-416c-a716-6e7bb90b274a','2016-09-15 14:58:38.233','SampleData','2016-09-15 14:58:38.233','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'0d5e06a6-6151-41bd-9d9a-ad9f3110f455',300.00,'f0f3dc00-49b2-4450-8835-c5d42ef5c0ba','fe9577de-f199-44ae-bce3-600277e4f4b8','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'89fa8eac-81e7-44c8-aa9f-b627328f0bbb',1500.00,'e61065f5-2a00-4465-b4f5-f2eb54713313','1ff8cc80-89df-416c-a716-6e7bb90b274a','2016-09-15 14:58:38.233','SampleData','2016-09-15 14:58:38.233','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'5926c595-7a4d-452e-9ba8-ed6a256c0659',50.00,'81a07752-af84-4c7d-a875-c337d7ccaa05','1ff8cc80-89df-416c-a716-6e7bb90b274a','2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [Rates] ([Id],[Amount],[RateTypeId],[StaffingResourceId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'f26fdd13-349c-4f2c-80ba-ed89a0eb06b3',180.00,'81a07752-af84-4c7d-a875-c337d7ccaa05','9332040c-7103-4ef8-8ebb-ef89c46fa089','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [PhoneNumberTypes] ([Id],[Name],[Default],[RowVersion]) VALUES (
'a0e0d253-964a-4733-bf41-323badb6698e','Home',1,0);
INSERT INTO [PhoneNumberTypes] ([Id],[Name],[Default],[RowVersion]) VALUES (
'b1339954-3bfe-4abd-91db-33bf35c617a7','Mobile',0,0);
INSERT INTO [PhoneNumberTypes] ([Id],[Name],[Default],[RowVersion]) VALUES (
'1fd3e8ba-8586-4e90-adff-a92f9ad8f191','Work',0,0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'680c3157-80bf-4745-9dfc-036befb9365a','206','555-2344','1fd3e8ba-8586-4e90-adff-a92f9ad8f191','c5e986b1-ac09-4ccc-94db-f8a302bfbda2',0,'2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'670e5dc5-5f40-4cac-91b7-043e9ab83626','071','555-4444','a0e0d253-964a-4733-bf41-323badb6698e','75eeb1fb-6da6-4117-8bfa-874f371e6e88',1,'2016-09-15 14:58:38.240','SampleData','2016-09-15 14:58:38.240','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'31b787c9-e210-41a2-acaf-2af2c6f645c7','382','555-2938','1fd3e8ba-8586-4e90-adff-a92f9ad8f191','dfcd4313-4979-40af-9023-7e0ebede326a',0,'2016-09-15 14:58:38.243','SampleData','2016-09-15 14:58:38.243','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'730862ce-eee8-4b00-a110-2cc8a7fcd847','071','555-3453','1fd3e8ba-8586-4e90-adff-a92f9ad8f191','1ff8cc80-89df-416c-a716-6e7bb90b274a',0,'2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'1ee0b832-2822-4bd7-ae5c-2d85cfdd3070','206','555-9857','a0e0d253-964a-4733-bf41-323badb6698e','ab32efb3-3379-4a5d-8aca-5159bd911549',1,'2016-09-15 14:58:38.213','SampleData','2016-09-15 14:58:38.213','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'86ce91e2-bee0-4faf-9f85-301905f66b9e','071','555-7773','a0e0d253-964a-4733-bf41-323badb6698e','d80153c7-21c8-4de1-85ce-af2504a7ea4b',1,'2016-09-15 14:58:38.233','SampleData','2016-09-15 14:58:38.233','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'88b55d37-3210-4f35-a72a-3253b3ea5ec9','206','555-5176','1fd3e8ba-8586-4e90-adff-a92f9ad8f191','fe9577de-f199-44ae-bce3-600277e4f4b8',0,'2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'bc0c2118-11bc-41e7-8326-60f2fba8a75a','071','555-4848','a0e0d253-964a-4733-bf41-323badb6698e','1ff8cc80-89df-416c-a716-6e7bb90b274a',1,'2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'a1154d2c-aa8d-4d13-a06e-83dc10257486','206','555-3355','1fd3e8ba-8586-4e90-adff-a92f9ad8f191','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67',0,'2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'950d30e3-45f7-4c35-a87b-9ac4f8ab869d','071','555-0452','1fd3e8ba-8586-4e90-adff-a92f9ad8f191','75eeb1fb-6da6-4117-8bfa-874f371e6e88',0,'2016-09-15 14:58:38.240','SampleData','2016-09-15 14:58:38.240','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'65e1ed5d-451b-4694-aa65-9be628679ec9','206','555-1189','a0e0d253-964a-4733-bf41-323badb6698e','c5e986b1-ac09-4ccc-94db-f8a302bfbda2',1,'2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'e9104ccf-2007-45be-bb66-ac181115839d','206','555-9482','a0e0d253-964a-4733-bf41-323badb6698e','9332040c-7103-4ef8-8ebb-ef89c46fa089',1,'2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'b29f6b91-097a-49e4-a544-ba9f0b1710cf','206','555-8122','a0e0d253-964a-4733-bf41-323badb6698e','fe9577de-f199-44ae-bce3-600277e4f4b8',1,'2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'7c1c5f5e-e23b-4a0e-91eb-cdadccb13098','071','555-0428','1fd3e8ba-8586-4e90-adff-a92f9ad8f191','d80153c7-21c8-4de1-85ce-af2504a7ea4b',0,'2016-09-15 14:58:38.233','SampleData','2016-09-15 14:58:38.233','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'ecabd8c9-b8a7-463e-8da9-dd86e16828f8','206','555-3412','a0e0d253-964a-4733-bf41-323badb6698e','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67',1,'2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'24fa4932-57aa-4816-b8ee-e2951f31415a','382','293-2938','a0e0d253-964a-4733-bf41-323badb6698e','dfcd4313-4979-40af-9023-7e0ebede326a',1,'2016-09-15 14:58:38.243','SampleData','2016-09-15 14:58:38.243','SampleData',0);
INSERT INTO [PhoneNumbers] ([Id],[AreaCode],[Number],[PhoneNumberTypeId],[StaffingResourceId],[Primary],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'116c5c07-3de3-4b8f-b9c8-e7fdc2ef47b9','206','555-0123','1fd3e8ba-8586-4e90-adff-a92f9ad8f191','9332040c-7103-4ef8-8ebb-ef89c46fa089',0,'2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [AddressTypes] ([Id],[Name],[DisplayName],[Default],[RowVersion]) VALUES (
'fdd73aba-6b16-4ed6-954f-51b0cbc636e1','Work','Work Address',0,0);
INSERT INTO [AddressTypes] ([Id],[Name],[DisplayName],[Default],[RowVersion]) VALUES (
'f2f12f23-3f3e-45e3-8bf9-aa9ea3065c3f','Home','Home Address',0,0);
INSERT INTO [AddressTypes] ([Id],[Name],[DisplayName],[Default],[RowVersion]) VALUES (
'49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','Mailing','Mailing Address',1,0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'e26e354f-37dc-490d-b3fc-0589d2a02731','449 11th Ave W','Suite 101','Seattle','ab32efb3-3379-4a5d-8aca-5159bd911549','f2f12f23-3f3e-45e3-8bf9-aa9ea3065c3f','98123',0,'4e6634b9-3065-4522-9ab6-1bcb14a7a8e0','2016-09-15 14:58:38.213','SampleData','2016-09-15 14:58:38.213','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'b40eb7bc-0d67-4044-9d0a-1af510403f0b','Coventry House  Miner Rd.','','London','d80153c7-21c8-4de1-85ce-af2504a7ea4b','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','EC2 7JR',1,'d5eed47d-a6a5-4bde-9d7d-03c1fd649d8c','2016-09-15 14:58:38.233','SampleData','2016-09-15 14:58:38.233','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'69f17770-dfee-4f04-bc52-3052ace75181','7 Houndstooth Rd.','','London','75eeb1fb-6da6-4117-8bfa-874f371e6e88','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','WG2 7LT',1,'d5eed47d-a6a5-4bde-9d7d-03c1fd649d8c','2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'7eb9079b-8f74-4a7d-88cf-3d5c7acac2c2','507 - 20th Ave. E.','Apt. 2A','Seattle','ab32efb3-3379-4a5d-8aca-5159bd911549','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','98122',1,'4e6634b9-3065-4522-9ab6-1bcb14a7a8e0','2016-09-15 14:58:38.210','SampleData','2016-09-15 14:58:38.210','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'4bebb5af-e6c2-4cb5-8b27-53481e3eb982','908 W. Capital Way','','Tacoma','9332040c-7103-4ef8-8ebb-ef89c46fa089','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','98401',1,'4e6634b9-3065-4522-9ab6-1bcb14a7a8e0','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'62e3e4f6-7f82-47ff-8ab7-bec9f524427a','18233 N.Wunderkindt','','Munich','dfcd4313-4979-40af-9023-7e0ebede326a','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','32382',1,'5e23bad7-755b-415d-9aca-8acbe87c1da8','2016-09-15 14:58:38.240','SampleData','2016-09-15 14:58:38.240','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'c6be2174-ca12-4c91-aad7-c867672ae45d','4110 Old Redmond Rd.','','Redmond','fe9577de-f199-44ae-bce3-600277e4f4b8','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','98052',1,'4e6634b9-3065-4522-9ab6-1bcb14a7a8e0','2016-09-15 14:58:38.227','SampleData','2016-09-15 14:58:38.227','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'84dcac2e-0f39-4b37-9550-e1b597758538','722 Moss Bay Blvd.','','Kirkland','5c45a0b7-08c6-42a2-b4ec-dfecfbac8c67','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','98033',1,'4e6634b9-3065-4522-9ab6-1bcb14a7a8e0','2016-09-15 14:58:38.223','SampleData','2016-09-15 14:58:38.223','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'b28efdd1-3c72-436c-b7f9-f0ab8aa97a9b','14 Garrett Hill','','London','1ff8cc80-89df-416c-a716-6e7bb90b274a','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','SW1 8JR',1,'d5eed47d-a6a5-4bde-9d7d-03c1fd649d8c','2016-09-15 14:58:38.230','SampleData','2016-09-15 14:58:38.230','SampleData',0);
INSERT INTO [Addresses] ([Id],[Address1],[Address2],[City],[StaffingResourceId],[AddressTypeId],[Zipcode],[Primary],[StateId],[Created],[CreatedUser],[Modified],[ModifyUser],[RowVersion]) VALUES (
'19f333b5-fe4a-4faa-80df-f944058c6e0d','4726 - 11th Ave. N.E.','','Seattle','c5e986b1-ac09-4ccc-94db-f8a302bfbda2','49fc1cb7-e292-425a-8cf5-bb5f8c7a06d3','98105',1,'4e6634b9-3065-4522-9ab6-1bcb14a7a8e0','2016-09-15 14:58:38.237','SampleData','2016-09-15 14:58:38.237','SampleData',0);
CREATE INDEX [IX_StaffingResourceId_WorkExperienceItems] ON [WorkExperienceItems] ([StaffingResourceId] ASC);
CREATE INDEX [IX_StaffingResourceId_Skills] ON [Skills] ([StaffingResourceId] ASC);
CREATE INDEX [IX_RateTypeId_Rates] ON [Rates] ([RateTypeId] ASC);
CREATE INDEX [IX_StaffingResourceId_Rates] ON [Rates] ([StaffingResourceId] ASC);
CREATE INDEX [IX_PhoneNumberTypeId_PhoneNumbers] ON [PhoneNumbers] ([PhoneNumberTypeId] ASC);
CREATE INDEX [IX_StaffingResourceId_PhoneNumbers] ON [PhoneNumbers] ([StaffingResourceId] ASC);
CREATE INDEX [IX_AddressTypeId_Addresses] ON [Addresses] ([AddressTypeId] ASC);
CREATE INDEX [IX_StaffingResourceId_Addresses] ON [Addresses] ([StaffingResourceId] ASC);
CREATE INDEX [IX_StateId_Addresses] ON [Addresses] ([StateId] ASC);
COMMIT;

