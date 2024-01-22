import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Luca Pirrone',
  authorAddress: 'lpirrone2000@gmail.com',
  cdkVersion: '2.61.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~5.0.0',
  name: 'cdk-cheshire-cat',
  projenrcTs: true,
  repositoryUrl: 'https://github.com/lpirrone2000/cdk-cheshire-cat.git',
  gitignore: [
    'cdk.out',
    '__pycache__',
  ],
  sampleCode: false, // do not generate sample test files

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();