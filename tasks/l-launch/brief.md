# A message from the client

Hi! I run CoralBricks, a small company that gives developers fast access to lots of AI models through one API. I've never made a video and honestly know nothing about animation, but I want a launch video for our homepage, about a minute long, that feels alive and expensive, like the ones Apple or Stripe put out. I'd rather it be amazing than quick. Here's what I'm picturing, in this order:

1. A coral ball drops in from the top and bounces on the floor like a real rubber ball until it stops.
2. Someone flicks a coral puck across the floor to the other side, like in air hockey.
3. Our little coral dot gets tossed from one side of the screen to the other, like throwing a ball to a friend.
4. A pricing card slides in from the right with a small coral tag hanging from a pin near its top corner, like a luggage tag. When the card stops, the tag should keep swinging a little, like a real one would.
5. A round coral badge with a white tick pops up in the middle to say it worked. It should feel really satisfying.
6. Five things we're proud of come in as a list: "Every model", "One key", "Pay per token", "No setup", "Fast everywhere". I want it smooth, not robotic.
7. Three short lines, shown one at a time in the middle: "Clear language.", "Useful details.", "One coral accent." People should actually have time to read them.
8. A small dot appears in the middle, grows into a long line across the screen, and that same line ends up underlining a big title, "One API.", that comes up above it.
9. Show how a request travels: "Request", then "Route", then "Reply", like we're gliding sideways from one to the next and stopping on each.
10. A chat answer typing out at our model's real speed, about 340 tokens a second, so people see how fast it is. The answer is in assets/tokens.json, already split into its tokens: use them exactly. Put a little coral cursor at the end while it's typing.
11. A big counter of how many requests we served today, going up to 1,284.
12. Then the screen swipes up into a dark terminal that shows: $ curl https://inference.coralbricks.ai/v1/chat/completions
13. Our big headline: "Clear language." with "Useful details." under it, the word "details." in our coral. I'd like it to slide up into place nicely.
14. I'll put music under the whole video at 120 BPM, starting on the very first frame. "All models, one API." should come in word by word with the music.
15. End on our logo (assets/logo-icon.svg) with the name CoralBricks next to it, big in the middle, and hold it.

Our designer's brand guide is in BRAND.md. Thanks!!

---

## Tagging for the review tool (added by motionbench, not part of the client's message)

The piece is one `index.html` as in `CONTRACT.md`, 1920×1080, between 40 and 90 seconds long. Tag these elements with `data-role` (one element each, the one that moves):

| Scene | Roles |
|---|---|
| 1 | `ball` |
| 2 | `puck` |
| 3 | `toss` (the dot) |
| 4 | `card`, `tag` |
| 5 | `badge` |
| 6 | `feature-1` … `feature-5`, top to bottom |
| 7 | `read-1`, `read-2`, `read-3` |
| 8 | `line` (the dot that becomes the line), `headline` |
| 9 | `world` (whatever slides sideways), `stop-1`, `stop-2`, `stop-3` (the three words) |
| 10 | `reply` (the text), `cursor` |
| 11 | `count` (the number's text) |
| 12 | `prompt` (the terminal line) |
| 13 | `rise-1`, `rise-2` (the two lines), `accent` (the word "details.") |
| 14 | `word-1` … `word-4` |
| 15 | `mark`, `wordmark` |

A scene's elements should be off screen (or invisible) while other scenes play.
