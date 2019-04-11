This section will help you run a local version of the viewer; useful for contributing to this project!

## Tools we use

Below is a list of the software you'll need to download and install before continuing:

- A source code editor. We use [Visual Studio Code](https://code.visualstudio.com/), but feel free to use one you're most comfortable with.
- [Git](https://git-scm.com/downloads)

  > A version control system (VCS) for tracking changes in computer files and coordinating work on those files among multiple people.

- [Node.js](https://nodejs.org/en/)

  > Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine. Node.js uses an event-driven, non-blocking I/O model that makes it lightweight and efficient. Node.js' package ecosystem, npm, is the largest ecosystem of open source libraries in the world.

## Github and Fork

Now that you've got all the required software installed, you'll want to make an account on github.com (if you haven't already done so). Once signed in, fork this project so you have your own copy.

## Setting up the environment

Next we'll install some node.js packages, clone your forked copy of this project, and get it ready to be run locally on your machine.

1. First, open git bash, or a command terminal where git is installed
2. Change your current working directory to one where you'd like to store this project
3. Run the following commands:
  - `git clone git@github.com:(YOUR GITHUB USERNAME)/fgpv-vpgf.git`
  - `git remote add upstream https://github.com/fgpv-vpgf/fgpv-vpgf.git`
  - `git fetch --all`
  - `git checkout develop`
  - `npm install`

## Running a local copy

Using the command `npm run serve`, you can now open your preferred browser and navigate to `http://localhost:6001/samples/index-mobile.html`. You should see the viewer loading on your screen.

Take a moment to browse the `http://localhost:6001/samples/` folder. There are a few different pages you can load and test. `index-fgp-en.html` is an embedded map with no layers by default. Also look at the `.json` config files to start understanding the various options available for customizing the map.


## Useful Commands

|Command|Description|
|---------|----------|
|`npm run build`|Creates local build folder|
|`npm run build -- --env.prod`|Creates local build folder in production mode, including a zipped dist folder|
|`npm run serve`|Runs a local server|
|`npm run serve -- --env.prod`|Runs a local server in production mode|
|`npm run protractor`| Runs protractor tests |
