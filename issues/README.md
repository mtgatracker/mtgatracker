# Reporting Issues

Before reporting issues, please take a quick look at our
[open issues](http://github.com/shawkinsl/mtga-tracker/issues).If there is already an open issue
for whatever you're experiencing, please feel free to like, comment, or bump the issue thread--this
helps us know it's a wanted feature--but please _do not_ create a duplicate issue.

If your issue has not yet been reported, there are plenty of ways to do so. For simpler questions or issues, we prefer:
- [Tweeting at us](http://twitter.com/MTGATrackerDevs)
- [Emailing us](mailto:dev.mtgatracker@gmail.com)

For bug reports, please file a [Github Issue](http://github.com/shawkinsl/mtga-tracker/issues),
following the [reporting guidelines](#reporting-guidelines) below. If you do not
have a github account, you can also email us, though this may take longer for us to triage.

## Reporting Guidelines

When reporting bugs, please always include (whenever possible):

- `output_log.txt` from MTGA containing gameplay for your issue
	- Located at: `%APPDATA%/../LocalLow/Wizards of the Coast/MTGA` (you can paste this into Windows Explorer)
- `mtga_watch.log` from MTGATracker's install directory
- Video / gif evidence of the issue with _both_ MTGA Tracker _and_ MTGA visible
(you may need to upload to a 3rd party, like youtube or vimeo)

~~Note that you can also use the "report an issue" button from within MTGA Tracker to automatically
send the first two bullets to us. You will be presented with a reference id; please note it in
any additional bug reports.~~ (not yet implemented, see: #52 )

We know not everyone will be able to screen record every time they play, but please
understand that it is very, very hard to debug issues without ground truth. For
example, it is entirely possible that MTGA Tracker did everything exactly correct
according to the output log, and that the bug experienced is one with MTGA's logging!
Even if this is not the case, without video evidence that some game state was parsed or
displayed incorrectly, it may be preventatively cumbersome to establish ground-truth
from the output log alone. (Try reading it sometime; it is very dense, and very noisy!)
Furthermore, since MTGA does not yet support friendly matches, it is not yet possible
to reproduce issues at will based only on descriptions.

Please understand that we may dismiss issues without adequate evidence or data.
This is not us saying we don't believe you or that the issue is not important;
just that we have no way to work on it without ground truth. Thanks for your
understanding. (But didn't you want to try out streaming, anyways? ;) )

Our favorite screen recording software is [OBS - Open Broadcaster Software](https://obsproject.com/).
It is free and open source, and was surprisingly easy to go from "first launch" to
"recording screen." Please give it a try if you want to support us with quality bug reports; we thank you in advance!

## Feature Requests

Feature requests are also welcome! You can use any contact method listed above, or if
you are feeling generous (or, just REALLY want your feature implemented), consider
submitting a [wish on our beerpay](https://beerpay.io/shawkinsl/mtga-tracker) :)
([here's some info about how beerpay works](https://beerpay.io/faqs.html)). Your wishes and donations
will go directly back into MTGATracker. See our fundraising goals / wishlists
[here!](https://github.com/shawkinsl/mtga-tracker/blob/master/contributors/fundraising.md)