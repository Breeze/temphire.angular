# Welcome to TempHire Angular #

This example demonstrates a reference architecture for data driven business applications. It uses Angular as the overall application framework and Breeze for the distributed client data management.

The application demonstrates common scenarios found in these types of applications such as multi-screen routing, master-detail views, editing, saving etc.

### Prerequisites ###

TempHire is available with both a .NET server and a Node.js server. Pick the technology you are familiar with. 

#### Node requirements ####

1. Node 6.10.2 or higher
2. Npm 3.0 or higher
3. Gulp `npm install gulp -g`

#### .NET requirements ####

1. Visual Studio 2015 Update 3 or higher
2. [TypeScript 2.4](https://blogs.msdn.microsoft.com/typescript/2017/06/27/announcing-typescript-2-4/) or higher
1. Node 6.10.2 or higher
2. Npm 3.0 or higher
3. Gulp `npm install gulp -g`

### Build and run the application ###

#### Node ####

1. `npm install`
2. `gulp`
3. Open browser to http://localhost:3000/

For more information on the node server, read the [Server Readme](./Express/README.md).

#### Visual Studio ####

Open the solution in Visual Studio, build and run. It should automatically restore all npm and NuGet packages. The database gets automatically created. 

If there are issues with building the solution, then it's most likely because Visual Studio is using outdated versions of the web tools or is missing them. In this case install the latest Node 6.x from [https://nodejs.org](https://nodejs.org) and make sure you choose to add it to your path.

You will also need to install Gulp globally, so that Visual Studio will find it in your path.

`npm install gulp -g`

Once everything is installed, in Visual Studio go to Tools|Options|Project and Solutions|External Web Tools and make sure Visual Studio is using $(PATH) as seen below as the location for the external web tools.

![External Web Tools](vs-config.png?raw=true "External Web Tools")
