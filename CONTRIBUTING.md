# Contribution

## Responsible Disclosure

_This section adopted from Auth0's [responsible disclosure program](https://auth0.com/whitehat)._

MTGA Tracker encourages responsible security research. If you intend to use MTGATracker systems in an attempt to find and disclose sensitive issues, please reach out to us beforehand (so we don't ban your account for suspicious activity). MTGATracker is an open source community project that currently generates no income, so we unfortunately do not have a bounty program. However, if you are interested in trying your hand at being a hacker, we ask that you follow these guidelines:

- Always disclose to us that you intend to perform security research on our systems, preferably beforehand
- If you think you have found an exploit on our systems, contact us immediately. If you think you have found an exploit on MTGA systems, please contact Wizards of the Coast immediately.
    - We _do not_ condone, nor have the authority to permit security research on any Wizards of the Coast systems. You should **always** reach out to _them_ before performing security research on any Wizards of the Coast systems.
- If you find data you do not own, please encrypt it with a secure key before sending it to us.
   - After reporting, you must delete said data from any of your computers or systems within 24 hours
- **Please, don't DOS us!** If you are sending requests to our public API's, please always rate limit yourself to _one request each 5 seconds._ MTGATracker is currently using free-tier'ed systems, and we probably won't be able to afford to keep running the services if we exceed free limits. Please be kind to other trackers, and help us keep helping you! (Note that we will eventually impose rate limits ourselves, but at this point, please just be kind to us :) )

Did you find a security issue, a data leak, or a sensitive bug? Please disclose any issues of a sensitive nature to [devs.mtgatracker@gmail.com](mailto:devs.mtgatracker@gmail.com), and do not file public issues. We know MTGA game data isn't exactly super sensitive, but in the age of data leaks & privacy injustices, we don't want to just meet the status quo.

We will do our best to acknowledge the receipt of your report as soon as we can. When we do, we will provide you with an estimated guess at how long it will take us to fix it. We'll also follow up with you once it's fixed. Until this time, we ask that you do not disclose sensitive issues to other parties (but once we've fixed the issue, feel free to let the world know you're awesome at finding bugs & exploits!) We'll even recognize you in our repo, with your permission, as a public thanks for making our platforms more secure.

## Looking for a way to contribute?

Check out our [open issues](https://github.com/shawkinsl/mtga-tracker/issues). Consider using the filter for 
["good for first issue" issues](https://github.com/shawkinsl/mtga-tracker/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22),
our [current projects](https://github.com/shawkinsl/mtga-tracker/projects), or our [code climate smells / issues](https://codeclimate.com/github/shawkinsl/mtga-tracker/issues).
Not a programmer? Consider [buying us a beer](https://beerpay.io/shawkinsl/mtga-tracker),
[![Starring our project](https://img.shields.io/github/stars/shawkinsl/mtga-tracker.svg?logo=github&label=Starring%20our%20project)](https://github.com/shawkinsl/mtga-tracker/stargazers),
and/or following / subscribing to
[our core contributors](https://github.com/shawkinsl/mtga-tracker/blob/master/contributors/core.yml) to keep us
motivated to keep working on this :)

## Contribution workflow

1. Create an issue for your changes. (Skip this step if changes are trivial).
1. Create a fork (or branch, if collaborator+)
1. Make your changes
    - If you created an issue, or are resolving an existing issue, reference it in your commit (see: [github docs](https://help.github.com/articles/closing-issues-using-keywords/))
1. Create a pull request
    - All checks ~~and tests~~ (see: [#41](https://github.com/shawkinsl/mtga-tracker/issues/41), [#42](https://github.com/shawkinsl/mtga-tracker/issues/41)) must pass


#### Core contributors

Core contributors are allowed to approve pull requests into master + collaborator permissions.
Core contributors must meet one of the following criteria:

- Have merged 3+ approved pull requests with no work needed
- Have merged 10+ approved pull requests (with or without work needed)
- Have contributed actionable input in 10+ approved pull requests
- Have merged 300+ total LOC changed
- Have made significant contributions otherwise (at the discretion of other core contributors)

And must meet all of the following criteria:

- Have been active in at least 1 code review / pull request in the last year
- Have approval from at least one other core-contributor

#### Collaborators

Collaborators are allowed to make branches directly within the mtga-tracker repo. They are encouraged to participate in
pull requests, but a Collaborator's approval is not sufficient to merge into master without a core-contributor's
approval. Collaborators must meet one of the following criteria:

- Have merged 1+ approved pull request with no work needed
- Have merged 3+ approved pull requests (with or without work needed)
- Have contributed actionable input in 3+ approved pull requests
- Have merged 50+ LOC total LOC changed
- Have made contributions otherwise (at the discretion of core contributors)

And must meet all of the following criteria:

- Have been active in at least 1 code review / pull request in the last year
- Have approval from at least one other collaborator
