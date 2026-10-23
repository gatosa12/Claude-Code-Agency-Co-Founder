# Writing the story (story.json → slides[].say)

Five slides, one beat each, one story ABOUT A SUBJECT (a brand, a company, a moment in history, a business's own
story). Never about the tool that made it.

| slide | beat | job | Nintendo example |
|---|---|---|---|
| 01 | hook | the surprising fact, stated flat | "Nintendo is one hundred and thirty seven years old. For most of that time, it never made a video game." |
| 02 | origin | where and how it began: a date, a place, a name | "It began in eighteen eighty-nine in Kyoto. Fusajiro Yamauchi made hanafuda, Japanese playing cards." |
| 03 | turn | the struggle: what was tried, what failed | "In the sixties, Hiroshi Yamauchi tried everything. A taxi company. Instant rice. All failed. Then came toys." |
| 04 | how | the breakthrough: the person + the thing they made | "Engineer Gunpei Yokoi built the Ultra Hand toy. In nineteen eighty, his Game and Watch put games in your pocket." |
| 05 | payoff + CTA | the famous result, the twist that ties back to the hook, the CTA | "A year later, Donkey Kong gave us Mario. And Nintendo still makes playing cards. Follow for more brand stories." |

## Rules
- **14–20 words a slide.** At speed 1.0 that is 6.5–7.5 s of voice in a 10 s slide, leaving a 2.5–3 s tail for the
  last picture and the swipe cue. voice.py flags anything under 1.2 s of tail: cut words, never speed up the voice.
- **Every sentence is a cut point.** Short sentences ("All failed.") are the strongest beats: they get a black card,
  a drop in the music, a serif caption.
- **Written for the ear.** Numbers as they are said ("eighteen eighty-nine", "one hundred and thirty seven"); the
  build shows digits where it wants them (a count-up, a title "1889").
- **Everything said is true.** Put the source of every fact in `story.json → facts` (one line each, with the page).
  Check dates against a primary or encyclopedic source; drop anything disputed (the example left out the "love
  hotels" story: no evidence in the securities filings). A number about the carousel itself ("made in twenty
  minutes") must also be true: `timer.py --claim`.
- **One picture can prove each phrase.** If a phrase has no real picture anywhere (Commons, NASA, Mixkit, the real
  web page, the logo), rewrite the phrase.
- **The hook's second sentence is the turn**: music_windows.py puts the track's drop on its first word.
- **The CTA is spoken** and is the last line of slide 05 ("Follow for more brand stories.").
- **Foreign names**: add a one-word respelling in `story.json → pronounce` ("Yamauchi": "Yahmah-oochee") and let
  check_audio.py confirm Whisper hears the real name back.
