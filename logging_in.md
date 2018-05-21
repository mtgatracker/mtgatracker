# How to log in to inspector

Howdy! You probably got dumped here after attempting to log in to [MTGA Tracker: Inspector](https://inspector.mtgatracker.com/)
for the first time. Unfortunately, we need to verify that you own the MTGA account you're trying to log in with before we allow you to log in to MTGATracker: Inspector.

We'll be happy to get you set up over in the discord; simply join our server using [this
link](https://discord.gg/j5u76j2). Once you've joined the server, our bot will send you a PM with the next instructions. Note that you will need to complete at least one game with the tracker running before our systems will be able to verify you.

You can stop reading now and go get logged in, or you can keep reading here to learn about what we're doing here & why.

### MTGA Tracker is "passwordless"

MTGA Tracker is committed to making passwords a relic of the past. Lots of security companies (for example,
[Auth0](https://auth0.com/passwordless)) are championing the idea of "Passwordless" login, and this is a trend we want
to follow. Passwords are inherently insecure, as they are created by fallible humans who are more or less easy
to predict, and who are terrible at remembering long, truly random passwords. We also never want to put our users in
a scenario where they might mistakenly or otherwise share their MTGA password with us. Therefore, we just don't use 
passwords!

Instead, we will use MTGA as the source of trust (once MTGA has a friends list). We will simply message your MTGA
account a 6-digit rotating access code as you try to log in. Since you, and only you, are able to log in to your MTGA
account, when you tell use that same 6 digit passcode, we know it's you!

Of course, MTGA doesn't have a friends list, or buddy messaging, yet. So in the meantime, we're using discord, a bot, and a team
of mods who can manually verify your identity if our bots get hung up on something. Once a bot or mod has verified
your identity (one-time only), our discord bots will PM you your passcode, which you can then use to log in to inspector.

### Verifying your identity

All that's required for this step is that you are in the [mtgatracker discord server](https://discord.gg/j5u76j2) (it's free!), and are logged in to the MTGA beta forums. The bot will send you a message as you join the server that will walk you through the rest!

# MTGA Tracker, its bots, and its mods, will NEVER ask for your MTGA password

If anyone asks for your password in relation to MTGATracker, please report it to Spencatro immediately. We will never
ask for your password, in any setting, for any reason.

## Inspector says my account is locked. What gives?

MTGATracker Inspector requires that your MTGATracker client is up to date. We ask that you always keep your client up
to date in case we find critical security issues, or are asked by Wizards to modify the tracker in any way in order
to stay in good standing. When you use an old tracker client, your account will be locked. **To unlock your account,** simply update to [the latest client](https://github.com/shawkinsl/mtga-tracker/releases/latest), and complete a match with it running.

## Inspector says my account is permanently locked. What gives _now?_

If you repeatedly abuse the account locking mechanism in order to use old client versions, your account will be
permanently locked. This means that a tracker admin will have to manually unlock it after you have plead your
case. We understand mistakes, but multiple offenders of this rule may be banned from the platform.

## Inspector says my account is banned. What?

You most likely will know what you did, but if you're not sure, you can ask us in discord. Generally, bans are issued to 
users who attempt to access other players' data without permission, or users who have harassed others within MTGATracker
or within platforms adjacent to MTGATracker. Bans are only issued manually, and likely will not be revoked. 
