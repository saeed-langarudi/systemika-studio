# Systemika Studio 1.0.6 Release Notes

Systemika Studio 1.0.6 is a WebApp deployment correction built on the stable 1.0.5 interface. There are no intentional desktop-interface changes in this release.

## WebApp deployment correction

The generated 1.0.5 WebApp already contained the current Output-panel code, but its public-deployment path could still present an older cached interface after files were replaced on a server. Two release-pipeline problems were corrected:

- Web launch URLs still carried older hard-coded cache identifiers from previous development milestones.
- The upload-ready WebApp did not include the project's `.htaccess` cache-control rules.

The 1.0.6 WebApp builder now derives cache keys from the current Systemika release version and applies them to the launcher, MultiSimulationAnalyser bundle, nested OpenSystemDynamics editor URL, and generated OpenSystemDynamics JS/CSS bundle references. It also includes `.htaccess` in the web release folder.

A `WEB_BUILD_INFO.txt` file is generated at the root of the upload-ready WebApp so a server deployment can be identified immediately.

## Deployment

Run:

```sh
node distribute/build.js
```

Then replace the existing public WebApp with the complete contents of:

`distribute/output/web/1.0.6/`

Do not selectively merge the new files into an older bundle. On a cPanel/Apache host, make sure hidden files are included so `.htaccess` is uploaded as well.

## Validation

- 333/333 automated regression tests pass.
- 19/19 permanent validation models are retained.
- A dedicated WebApp release test executes the builder and verifies current-version launch URLs, versioned generated assets, cache-control deployment, the build-information marker, and the presence of the current Output-panel implementation in the generated editor bundle.
