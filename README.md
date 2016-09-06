#Welcome to TempHire Angular 2#

This example demonstrates a reference architecture for data driven business applications. It uses Angular 2 as the overall application framework and Breeze for the distributed client data management.

The application demonstrates common scenarios found in these types of applications such as multi-screen routing, master-detail views, editing, saving etc.

### Prerequisites ###

Currently the backend is writting in .NET and requires Visual Studio 2015 Update 3.

### Running the application ###

Open the solution in Visual Studio, build and run. It should automatically restore all npm and NuGet packages. The database gets automatically created. 

If there are issues with building the solution, then it's mostly likely because Visual Studio is using an outdated version of npm, or npm is not installed. In this case install the latest Node 4.x from [https://nodejs.org](https://nodejs.org) and make sure you choose to add it to your path. We've made the best experience with npm v3 or higher. To update to npm v3 use the following utlity [https://www.npmjs.com/package/npm-windows-upgrade](https://www.npmjs.com/package/npm-windows-upgrade). 

Once everything is installed, in Visual Studio go to Tools|Options|Project and Solutions|External Web Tools and make sure Visual Studio is configured to use $(PATH) first to look for npm etc.

![External Web Tools](vs-config.png?raw=true "External Web Tools")