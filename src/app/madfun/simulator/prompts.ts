import type { Prompt } from './engine';

// Original scenes with a setup and an in-character cue.
export const SIMULATOR_PROMPTS: Prompt[] = [
  {
    "id": "p001",
    "category": "Group Chat",
    "text": "Everyone claims to be five minutes away, but their pins haven’t moved. The host is already holding a table.\n\nAs {name}: Send the text that gets everyone moving."
  },
  {
    "id": "p002",
    "category": "Group Chat",
    "text": "Someone asks for the plan directly underneath the pinned plan. There’s still time to correct the wrong address.\n\nAs {name}: Reply without retyping the itinerary."
  },
  {
    "id": "p003",
    "category": "Group Chat",
    "text": "A voice note titled “Quick thing” runs seven minutes. The others are on a bus with no headphones.\n\nAs {name}: Ask for the shortest possible recap."
  },
  {
    "id": "p004",
    "category": "Group Chat",
    "text": "Someone answers a message from 2019 without explanation. The thread was about a picnic that already happened.\n\nAs {name}: Welcome the time traveler back."
  },
  {
    "id": "p005",
    "category": "Group Chat",
    "text": "There are 612 unread messages and the latest just says “microwave”. Nobody will summarize and there’s a poll closing now.\n\nAs {name}: Ask the one question that gets useful context."
  },
  {
    "id": "p006",
    "category": "Group Chat",
    "text": "A friend accidentally adds their dentist to the group. The dentist responds with a flossing GIF.\n\nAs {name}: Write the welcome message before removing them."
  },
  {
    "id": "p007",
    "category": "Group Chat",
    "text": "Someone unsends a message and follows up with “do not ask”. The preview only showed the words “one goose”.\n\nAs {name}: Pick an opener that gets the whole story."
  },
  {
    "id": "p008",
    "category": "Group Chat",
    "text": "A grocery list lands in the chat with “backup olives” underlined. The person is currently at the store.\n\nAs {name}: Reply with a request that beats those olives."
  },
  {
    "id": "p009",
    "category": "Group Chat",
    "text": "Someone types for two minutes and sends “ok”. The group was waiting for a big decision.\n\nAs {name}: Send a response to that anticlimax."
  },
  {
    "id": "p010",
    "category": "Group Chat",
    "text": "A second chat opens to organize the first. The second chat immediately starts talking about snacks.\n\nAs {name}: Announce an actual purpose for it."
  },
  {
    "id": "p011",
    "category": "Group Chat",
    "text": "A schedule poll gets sixteen votes for “maybe”. The venue needs a firm head count tonight.\n\nAs {name}: Word the tie-breaking poll option."
  },
  {
    "id": "p012",
    "category": "Group Chat",
    "text": "Someone announces a social media break and immediately posts a story. The post is a screenshot of their screen time.\n\nAs {name}: Leave a gentle one-line correction."
  },
  {
    "id": "p013",
    "category": "Group Chat",
    "text": "Someone posts a blurry lamppost and writes “you had to be there”. Someone wants to use the blur as the trip poster.\n\nAs {name}: Give it a caption."
  },
  {
    "id": "p014",
    "category": "Group Chat",
    "text": "The person who knows the door code replies only in emojis. The guests are outside holding a melting cake.\n\nAs {name}: Ask the code keeper for a useful hint."
  },
  {
    "id": "p015",
    "category": "Group Chat",
    "text": "The chat gets a new rule to respond to complaints with “congratulations”. Someone drops their toast on the floor.\n\nAs {name}: Reply in the spirit of the new rule."
  },
  {
    "id": "p016",
    "category": "Group Chat",
    "text": "The only party detail is “wear comfortable shoes”. Everyone else assumes it’s a wedding.\n\nAs {name}: Ask the question that settles the dress code."
  },
  {
    "id": "p017",
    "category": "Group Chat",
    "text": "One friend begins addressing everyone as “esteemed shareholders”. The next message is about sharing a large fries.\n\nAs {name}: Write the official shareholder motion."
  },
  {
    "id": "p018",
    "category": "Group Chat",
    "text": "The chat is deleting every pinned message except one. One pinned message saves the weekend and another is just a photo of a spoon.\n\nAs {name}: State the case for your pick."
  },
  {
    "id": "p019",
    "category": "Group Chat",
    "text": "A calendar invite says “Thinking About It”. It blocks three hours of prime Saturday time.\n\nAs {name}: Write the RSVP note."
  },
  {
    "id": "p020",
    "category": "Group Chat",
    "text": "Two people send the same bad joke at the same second. Both friends claim copyright.\n\nAs {name}: Send the small-print judgment."
  },
  {
    "id": "p021",
    "category": "Group Chat",
    "text": "An “urgent” link opens to a picture of a bread clip. The link arrives right before someone turns off their phone.\n\nAs {name}: Write the urgent follow-up that makes that click worthwhile."
  },
  {
    "id": "p022",
    "category": "Group Chat",
    "text": "Someone screenshots the entire argument and sends it back to the same chat. Someone starts annotating the screenshots like homework.\n\nAs {name}: Reply in the margin."
  },
  {
    "id": "p023",
    "category": "Group Chat",
    "text": "A friend begins “serious question” and asks how many ducks a bus can hold. Half the group thinks the ducks are hypothetical.\n\nAs {name}: Ask for the missing specification."
  },
  {
    "id": "p024",
    "category": "Group Chat",
    "text": "Everyone reacts to a message with a different vegetable emoji. One reaction has to represent the group for the rest of the week.\n\nAs {name}: Nominate a vegetable with a reason."
  },
  {
    "id": "p025",
    "category": "Group Chat",
    "text": "The organizer demands proof from everyone who replies “down”. Nobody wants a lecture but the host has to buy tickets.\n\nAs {name}: Write the replacement word for “down.”"
  },
  {
    "id": "p026",
    "category": "Cabin Chaos",
    "text": "Someone ate the leftovers and claims they were communal. The fork is still in their hand.\n\nAs {name}: Deliver the opening statement in Cabin Court."
  },
  {
    "id": "p027",
    "category": "Cabin Chaos",
    "text": "The chill weekend itinerary now begins with a six-mile sunrise hike. Half the group packed slides, not hiking shoes.\n\nAs {name}: Pitch a different morning plan."
  },
  {
    "id": "p028",
    "category": "Cabin Chaos",
    "text": "The cabin has one spoon and eleven mugs. Breakfast is in five minutes and everyone ordered cereal.\n\nAs {name}: Announce how the spoon will be allocated."
  },
  {
    "id": "p029",
    "category": "Cabin Chaos",
    "text": "The hot tub is the temperature of sad tea. Nobody wants to say they’re cold first.\n\nAs {name}: Give the hot tub a new amenity name."
  },
  {
    "id": "p030",
    "category": "Cabin Chaos",
    "text": "An unexplained noise earns {name} an election to go investigate. The group hands over a flashlight with one working battery.\n\nAs {name}: Give them an exit line before going anywhere."
  },
  {
    "id": "p031",
    "category": "Cabin Chaos",
    "text": "Rain cancels every outdoor plan. The snacks and playing cards are already out.\n\nAs {name}: Name the emergency event you’re putting on the schedule."
  },
  {
    "id": "p032",
    "category": "Cabin Chaos",
    "text": "The kitchen contains nine lids and no bowls. Dinner arrives as a giant pot of soup.\n\nAs {name}: Invent the serving system that keeps everyone dry."
  },
  {
    "id": "p033",
    "category": "Cabin Chaos",
    "text": "Everyone brought marshmallows but nobody brought chocolate or crackers. The fire is lit and dessert is expected.\n\nAs {name}: Announce what’s officially replacing s’mores."
  },
  {
    "id": "p034",
    "category": "Cabin Chaos",
    "text": "The guestbook asks what every guest learned about themselves. The owner is likely to read the page.\n\nAs {name}: Write something funny but useful for the next guests."
  },
  {
    "id": "p035",
    "category": "Cabin Chaos",
    "text": "A singing wall fish interrupts a heartfelt moment. The fish only sings when anyone says “future”.\n\nAs {name}: Finish the conversation without setting it off."
  },
  {
    "id": "p036",
    "category": "Cabin Chaos",
    "text": "The group finishes a puzzle and finds an extra piece. Everyone insists they personally placed the true last piece.\n\nAs {name}: Invent a verdict for the extra."
  },
  {
    "id": "p037",
    "category": "Cabin Chaos",
    "text": "One mystery sock remains on the mantel at checkout. Nobody claims it but it’s been in every photo.\n\nAs {name}: Read the sock’s checkout announcement."
  },
  {
    "id": "p038",
    "category": "Cabin Chaos",
    "text": "The person who volunteered to make a fire pulls out a hair dryer. There’s a pile of wood, actual matches, and an extension cord.\n\nAs {name}: Decide what to tell the volunteer before they plug in."
  },
  {
    "id": "p039",
    "category": "Cabin Chaos",
    "text": "The cabin map marks one room simply “NO”. The landlord leaves the map on the coffee table with no explanation.\n\nAs {name}: Guess what the forbidden room is for."
  },
  {
    "id": "p040",
    "category": "Cabin Chaos",
    "text": "The nicest bedroom has an aggressively ticking clock. The rest of the room options are worse.\n\nAs {name}: Sell this room to your roommate in one sentence."
  },
  {
    "id": "p041",
    "category": "Cabin Chaos",
    "text": "The fridge is full and every item is a condiment. Hungry guests crowd behind you.\n\nAs {name}: Announce the name of tonight’s condiment-only special."
  },
  {
    "id": "p042",
    "category": "Cabin Chaos",
    "text": "The owner calls a bunk bed behind a curtain a private suite. The roommate expects room service too.\n\nAs {name}: Write the hotel review before they unpack."
  },
  {
    "id": "p043",
    "category": "Cabin Chaos",
    "text": "The only mirror is mounted at knee height. The group has a formal photo in ten minutes.\n\nAs {name}: Tell everyone how checking the mirror is going to work."
  },
  {
    "id": "p044",
    "category": "Cabin Chaos",
    "text": "The canoe manual is present but the canoe is missing. The group still wants a lake activity.\n\nAs {name}: Read a fake refresher from the useless manual."
  },
  {
    "id": "p045",
    "category": "Cabin Chaos",
    "text": "A friend proposes the mounted moose should join game night. There’s exactly one free chair at the table.\n\nAs {name}: Introduce the moose before somebody claims it."
  },
  {
    "id": "p046",
    "category": "Cabin Chaos",
    "text": "Campfire smoke follows {name} no matter where they sit. Friends accuse you of secretly moving the fire.\n\nAs {name}: Give the smoke a one-sentence warning."
  },
  {
    "id": "p047",
    "category": "Cabin Chaos",
    "text": "A deck chair has a hand-painted sign that says “only twice”. Someone has already sat there once today.\n\nAs {name}: Narrate what you think happens on the third sit."
  },
  {
    "id": "p048",
    "category": "Cabin Chaos",
    "text": "The lake view requires standing on a cooler. There’s a waiting list for the one cooler.\n\nAs {name}: Pitch an easier way to enjoy the view."
  },
  {
    "id": "p049",
    "category": "Cabin Chaos",
    "text": "There is a large indoor bell nobody can explain. One accidental ring makes everyone look up.\n\nAs {name}: Declare what that ring officially means."
  },
  {
    "id": "p050",
    "category": "Cabin Chaos",
    "text": "Four friends brought identical blankets and each swears theirs is different. The blankets are now all on one pile.\n\nAs {name}: Devise a test that doesn’t involve licking them."
  },
  {
    "id": "p051",
    "category": "Food Court",
    "text": "The last slice has already been cut into four increasingly tiny slivers. Everyone’s visibly waiting for permission.\n\nAs {name}: State the new rule for the last slice."
  },
  {
    "id": "p052",
    "category": "Food Court",
    "text": "The server asks for one check after everyone ordered separately. One person ordered water and another ordered two desserts.\n\nAs {name}: Announce the fairest way to split it."
  },
  {
    "id": "p053",
    "category": "Food Court",
    "text": "A restaurant calls toast a deconstructed sandwich. It comes with a $14 price tag.\n\nAs {name}: Deliver the shortest honest menu review."
  },
  {
    "id": "p054",
    "category": "Food Court",
    "text": "Someone claims every food is a soup, salad, or sandwich. You get one food to break their system.\n\nAs {name}: Name it and explain the loophole."
  },
  {
    "id": "p055",
    "category": "Food Court",
    "text": "A fancy menu offers “Chef’s Surprise” with no listed ingredients. The server says the chef decides how surprising it is.\n\nAs {name}: Name the surprise that makes you leave."
  },
  {
    "id": "p056",
    "category": "Food Court",
    "text": "A stranger cuts a pizza with kitchen scissors. The scissors produce a surprisingly perfect square.\n\nAs {name}: Decide whether they’re a genius or need to surrender the scissors."
  },
  {
    "id": "p057",
    "category": "Food Court",
    "text": "The vending machine gives out two snacks. A friend tries to claim the bonus as their commission.\n\nAs {name}: Issue the distribution ruling."
  },
  {
    "id": "p058",
    "category": "Food Court",
    "text": "A friend declines fries before reaching across the table. They take the crunchiest fry first.\n\nAs {name}: Say exactly what you’d tell them."
  },
  {
    "id": "p059",
    "category": "Food Court",
    "text": "The takeout bag contains five forks and a handwritten “good luck”. The order is all finger food.\n\nAs {name}: Guess what the restaurant was trying to warn you about."
  },
  {
    "id": "p060",
    "category": "Food Court",
    "text": "A charcuterie board consists entirely of gas-station snacks. The creator requests restaurant-level feedback.\n\nAs {name}: Pick the star item and review it thoughtfully enough to be funny."
  },
  {
    "id": "p061",
    "category": "Food Court",
    "text": "A delivery order arrives with a side nobody recognizes. Everyone is pretending they recognize it.\n\nAs {name}: Invent its menu name and nominate the first taster."
  },
  {
    "id": "p062",
    "category": "Food Court",
    "text": "A friend measures seasoning in one shake per person. The crowd size just doubled.\n\nAs {name}: Explain how to scale this recipe without creating a salt lick."
  },
  {
    "id": "p063",
    "category": "Food Court",
    "text": "The last cookie is shaped exactly like a shoe. Two people want to split it by geometry.\n\nAs {name}: Establish who gets the toe and who gets the heel."
  },
  {
    "id": "p064",
    "category": "Food Court",
    "text": "Someone wants to put glitter on pancakes. The recipe says it’s edible but the jar only says festive.\n\nAs {name}: Set the brunch rule before anyone starts sprinkling."
  },
  {
    "id": "p065",
    "category": "Food Court",
    "text": "A friend lists “confidence” as their potluck dish. Everything else is ready except a main course.\n\nAs {name}: Update their assigned dish in the group spreadsheet."
  },
  {
    "id": "p066",
    "category": "Food Court",
    "text": "The grocery store opens an emotional support chips section. The shelves are sorted by mood.\n\nAs {name}: Decide which mood deserves a new chip flavor."
  },
  {
    "id": "p067",
    "category": "Food Court",
    "text": "One person orders a pickle for dessert. It arrives under a silver cloche while the table watches.\n\nAs {name}: Write the judge’s tasting notes."
  },
  {
    "id": "p068",
    "category": "Food Court",
    "text": "The entire grocery haul needs a mascot. It must fit on the group’s picnic sticker.\n\nAs {name}: Nominate the one item that earned the spotlight."
  },
  {
    "id": "p069",
    "category": "Food Court",
    "text": "The barista writes “Chairperson” on {name}’s cup. The entire table adopts the title.\n\nAs {name}: Give an executive order before taking the first sip."
  },
  {
    "id": "p070",
    "category": "Food Court",
    "text": "A mystery box contains a waffle, a lime, and a very old receipt. A camera crew wants you to present the box as a mature dinner.\n\nAs {name}: Deliver your official description."
  },
  {
    "id": "p071",
    "category": "Food Court",
    "text": "A friend microwaves fish right before the movie. The host insists the smell will add atmosphere.\n\nAs {name}: Write the actual viewer advisory."
  },
  {
    "id": "p072",
    "category": "Food Court",
    "text": "A sub shop adds loyalty stamps for ordering politely. The customer in front of you earned a bonus stamp by saying “please” twice.\n\nAs {name}: Challenge or improve the policy."
  },
  {
    "id": "p073",
    "category": "Food Court",
    "text": "A frozen dinner instructs customers to “finish emotionally”. You’ve got less than a minute left on the microwave.\n\nAs {name}: Name the emotion the dish is supposed to be finished with."
  },
  {
    "id": "p074",
    "category": "Food Court",
    "text": "Someone spends three minutes reviewing tap water like wine. The server asks for pairing advice.\n\nAs {name}: Name the most pretentious side for their tap water."
  },
  {
    "id": "p075",
    "category": "Food Court",
    "text": "The ice cream truck has only a suspicious blue flavor left. A cone is already in your hand and a child is judging your courage.\n\nAs {name}: Give the blue flavor an attractive name."
  },
  {
    "id": "p076",
    "category": "Everyday Disasters",
    "text": "A stranger holds the door from a full block away. The door holder makes eye contact and commits.\n\nAs {name}: Give the line you say after the long courtesy jog."
  },
  {
    "id": "p077",
    "category": "Everyday Disasters",
    "text": "Self-checkout finds a banana suspicious. The banana is the only thing in the bagging area.\n\nAs {name}: Defend it to the machine like a lawyer."
  },
  {
    "id": "p078",
    "category": "Everyday Disasters",
    "text": "The elevator greets its occupants as finalists. Nobody knows what event they entered.\n\nAs {name}: Announce the competition your floor must be hosting."
  },
  {
    "id": "p079",
    "category": "Everyday Disasters",
    "text": "A line forms behind {name}, who wasn’t waiting in a line. The line is now long enough to block a door.\n\nAs {name}: Break the news to your accidental followers."
  },
  {
    "id": "p080",
    "category": "Everyday Disasters",
    "text": "The laundromat has a lost-and-found called Things That Survived. The attendant asks for a contribution.\n\nAs {name}: Nominate the most likely survivor from your own laundry."
  },
  {
    "id": "p081",
    "category": "Everyday Disasters",
    "text": "{name} waves back at someone waving at the person behind them. You still have half a wave left to deliver.\n\nAs {name}: Improvise what you turn it into."
  },
  {
    "id": "p082",
    "category": "Everyday Disasters",
    "text": "The printer finally works and prints a page from 2009. Everyone has been waiting for a current form.\n\nAs {name}: Explain the old page like it’s the system’s opening statement."
  },
  {
    "id": "p083",
    "category": "Everyday Disasters",
    "text": "A shop offers free plastic hangers with an application form. You need a hanger but not badly enough to list references.\n\nAs {name}: Give the fake reference you’re tempted to write."
  },
  {
    "id": "p084",
    "category": "Everyday Disasters",
    "text": "A clearly marked PULL door defeats {name} twice. A group has watched both attempts.\n\nAs {name}: Narrate the third one like a planned demonstration."
  },
  {
    "id": "p085",
    "category": "Everyday Disasters",
    "text": "A person waits patiently for a broken moving walkway to move. They’ve just asked you whether this walkway is normally this quiet.\n\nAs {name}: Answer kindly, in one line."
  },
  {
    "id": "p086",
    "category": "Everyday Disasters",
    "text": "The gift wrapping station provides one square of tape. The present is round and the recipient is almost here.\n\nAs {name}: Explain the design choice when they see it."
  },
  {
    "id": "p087",
    "category": "Everyday Disasters",
    "text": "A hairdresser wants a haircut description with no words about hair. There’s already a cape around your neck.\n\nAs {name}: Pitch your ideal look before the scissors come out."
  },
  {
    "id": "p088",
    "category": "Everyday Disasters",
    "text": "The dressing-room mirror has a sticker that says “Be honest”. You’re trying on something you thought was a very safe choice.\n\nAs {name}: Answer the mirror’s unspoken question."
  },
  {
    "id": "p089",
    "category": "Everyday Disasters",
    "text": "The only umbrella is stamped PROPERTY OF THE MUSEUM. It starts raining heavily the moment you open it.\n\nAs {name}: Explain yourself to the person who notices the stamp."
  },
  {
    "id": "p090",
    "category": "Everyday Disasters",
    "text": "A friend enters the same wrong room three times. Someone inside asks if this is where the meeting is.\n\nAs {name}: Make up what the meeting is about."
  },
  {
    "id": "p091",
    "category": "Everyday Disasters",
    "text": "A candle store launches a scent called Clean Hallway. The clerk asks if you can describe what the candle smells like without repeating the name.\n\nAs {name}: Sell it."
  },
  {
    "id": "p092",
    "category": "Everyday Disasters",
    "text": "A receipt in {name}’s pocket gets called to testify. The jury can only hear about one purchase today.\n\nAs {name}: Pick what the receipt would reveal."
  },
  {
    "id": "p093",
    "category": "Everyday Disasters",
    "text": "A cafe calls an order for “That Person,” and three people stand. The barista asks each claimant how they are that person.\n\nAs {name}: Give your evidence."
  },
  {
    "id": "p094",
    "category": "Everyday Disasters",
    "text": "A movie theater turns all the lights up during a suspenseful scene. Everyone blames you because you got up right beforehand.\n\nAs {name}: Tell them which scene is now much funnier."
  },
  {
    "id": "p095",
    "category": "Everyday Disasters",
    "text": "A shopping cart wheel seems to have its own destination. The cart keeps steering toward the cereal.\n\nAs {name}: Give your rebellious wheel a performance review."
  },
  {
    "id": "p096",
    "category": "Everyday Disasters",
    "text": "Easy-open packaging takes four people. Nobody will admit who finally opened it.\n\nAs {name}: Issue a rating for the package itself."
  },
  {
    "id": "p097",
    "category": "Everyday Disasters",
    "text": "An automatic sink refuses to acknowledge {name}. Three other sinks turn on for everybody else.\n\nAs {name}: Address this one like it owes you an explanation."
  },
  {
    "id": "p098",
    "category": "Everyday Disasters",
    "text": "The microwave has a note saying “Think about your choices”. A plate of leftovers is already inside.\n\nAs {name}: Guess the dish that inspired the original warning."
  },
  {
    "id": "p099",
    "category": "Everyday Disasters",
    "text": "The hallway light switches off just as someone finds their keys. Your friend is on the other side of the door.\n\nAs {name}: Deliver a request that gets them to rescue you."
  },
  {
    "id": "p100",
    "category": "Everyday Disasters",
    "text": "The same street performer seems to have followed the group for three blocks. The last song was suspiciously about traffic.\n\nAs {name}: Announce what tune the performer should play for your next block."
  },
  {
    "id": "p101",
    "category": "Travel Fails",
    "text": "The gate agent suggests getting comfortable after announcing a delay. The chairs have no outlets and every charger is dying.\n\nAs {name}: Share a realistic gate survival plan."
  },
  {
    "id": "p102",
    "category": "Travel Fails",
    "text": "The GPS declares arrival in a field. There’s no signal and the field has a single sheep.\n\nAs {name}: Decide what the GPS thinks you booked."
  },
  {
    "id": "p103",
    "category": "Travel Fails",
    "text": "Someone requests a bathroom break two minutes into a road trip. You can still see the driveway in the mirror.\n\nAs {name}: Give the car your new first stop’s official name."
  },
  {
    "id": "p104",
    "category": "Travel Fails",
    "text": "One suitcase has circled a carousel alone for twenty minutes. The carousel stops and the suitcase is still there.\n\nAs {name}: Give it a backstory before anyone touches it."
  },
  {
    "id": "p105",
    "category": "Travel Fails",
    "text": "Everyone packed for a different climate. The group picture happens in one minute.\n\nAs {name}: Invent a dress code that makes the mismatch look intentional."
  },
  {
    "id": "p106",
    "category": "Travel Fails",
    "text": "The hotel gym has one treadmill and a vase. The hotel app asks what fitness class you attended.\n\nAs {name}: Describe your workout using both objects."
  },
  {
    "id": "p107",
    "category": "Travel Fails",
    "text": "The scenic route is ninety percent fence. You have been the scenic-route advocate since breakfast.\n\nAs {name}: Point out one allegedly breathtaking feature."
  },
  {
    "id": "p108",
    "category": "Travel Fails",
    "text": "A train ticket says Seat 0. Every other seat has a number and a person in it.\n\nAs {name}: Explain where you think Seat 0 belongs."
  },
  {
    "id": "p109",
    "category": "Travel Fails",
    "text": "The souvenir shop sells the same mug under three city names. The friend behind the register asks for a fourth design.\n\nAs {name}: Pitch the fake hometown mug."
  },
  {
    "id": "p110",
    "category": "Travel Fails",
    "text": "Every passenger has the identical black carry-on. The rental shuttle leaves in two minutes.\n\nAs {name}: Tell everyone how you’re marking the group’s bags."
  },
  {
    "id": "p111",
    "category": "Travel Fails",
    "text": "The self-appointed DJ has played fourteen songs from one album. The DJ calls the next song “a real change of pace,” but it’s a remix.\n\nAs {name}: Request an intervention in one sentence."
  },
  {
    "id": "p112",
    "category": "Travel Fails",
    "text": "Hotel shampoo comes in a thumb-sized bottle. Someone asks if they can borrow it for a week.\n\nAs {name}: Explain the rationing policy."
  },
  {
    "id": "p113",
    "category": "Travel Fails",
    "text": "A shortcut is called Possibly Road. The other route is ninety minutes longer.\n\nAs {name}: Make the argument for or against Possibly Road."
  },
  {
    "id": "p114",
    "category": "Travel Fails",
    "text": "The supposed hidden gem is a parking lot with a mural. The group visits at sunset and has to review the “attraction”.\n\nAs {name}: Write the first line."
  },
  {
    "id": "p115",
    "category": "Travel Fails",
    "text": "A forty-minute uphill walk is advertised as a stroll. You’re reading the brochure at the top of the hill with no breath left.\n\nAs {name}: Correct the listing."
  },
  {
    "id": "p116",
    "category": "Travel Fails",
    "text": "An airport massage chair spontaneously activates. Your friends think you secretly paid for deluxe mode.\n\nAs {name}: Tell the chair what kind of ride you actually wanted."
  },
  {
    "id": "p117",
    "category": "Travel Fails",
    "text": "A tour guide asks {name} for a fun fact about a bench. Visitors have cameras ready and it’s a very ordinary bench.\n\nAs {name}: Give them one plausibly ridiculous fact."
  },
  {
    "id": "p118",
    "category": "Travel Fails",
    "text": "The best photo of the trip includes half a stranger’s thumb. Everyone votes to keep the photo.\n\nAs {name}: Write a credit acknowledging the guest star thumb."
  },
  {
    "id": "p119",
    "category": "Travel Fails",
    "text": "The rental car’s screen says “Good luck”. You have not started the engine yet.\n\nAs {name}: Announce the car’s catchphrase for the rest of the trip."
  },
  {
    "id": "p120",
    "category": "Travel Fails",
    "text": "Breakfast closes seconds before the group arrives. One bowl of oranges is still out for display.\n\nAs {name}: Negotiate with the group about what counts as breakfast."
  },
  {
    "id": "p121",
    "category": "Travel Fails",
    "text": "The main attraction is closed on the only day everyone is in town. Everybody already bought matching souvenirs.\n\nAs {name}: Invent a new main attraction worthy of wearing them."
  },
  {
    "id": "p122",
    "category": "Travel Fails",
    "text": "The gift shop sells only magnets of an ordinary intersection. The clerk insists it’s a bestseller.\n\nAs {name}: Explain what this intersection is famous for."
  },
  {
    "id": "p123",
    "category": "Travel Fails",
    "text": "A luggage tag says “Not yours, probably”. You can’t change the tag, but you have a marker.\n\nAs {name}: Add a line that convinces the baggage handler."
  },
  {
    "id": "p124",
    "category": "Travel Fails",
    "text": "The itinerary has seventeen stops and no meal break. The planner asks for exactly one cut.\n\nAs {name}: Sacrifice a stop and announce the replacement meal."
  },
  {
    "id": "p125",
    "category": "Travel Fails",
    "text": "A gate agent asks for the safety card in rhyme. Your boarding group goes next.\n\nAs {name}: Use a rhyme people would actually remember."
  },
  {
    "id": "p126",
    "category": "Awkward Moments",
    "text": "A stranger asks {name} to pretend they have been friends for years. The stranger’s real friends are waiting for an introduction.\n\nAs {name}: Supply a fake memory that makes this believable."
  },
  {
    "id": "p127",
    "category": "Awkward Moments",
    "text": "A plus-one insists they’ve met before but offers no clues. They’re waiting for you to remember where.\n\nAs {name}: Buy five seconds without just saying “of course.”"
  },
  {
    "id": "p128",
    "category": "Awkward Moments",
    "text": "Everyone at the reunion wears a name tag except the organizer. This person has somehow planned everything and knows everyone.\n\nAs {name}: Greet them without using a name."
  },
  {
    "id": "p129",
    "category": "Awkward Moments",
    "text": "A host introduces {name} as “the one I told you about”. Everyone has become silent and interested.\n\nAs {name}: Give them an equally intriguing one-line response."
  },
  {
    "id": "p130",
    "category": "Awkward Moments",
    "text": "A person bursts out laughing at a podcast only they can hear. They look up to find the whole room staring.\n\nAs {name}: Guess the topic as if you heard the joke too."
  },
  {
    "id": "p131",
    "category": "Awkward Moments",
    "text": "A friend whispers “act natural” with zero context. Nobody has explained who is watching.\n\nAs {name}: Say what you think you’re supposed to act natural about."
  },
  {
    "id": "p132",
    "category": "Awkward Moments",
    "text": "A barber offers “same as last time” at {name}’s first visit. The cape is already clipped on.\n\nAs {name}: Give a safe version of “the usual.”"
  },
  {
    "id": "p133",
    "category": "Awkward Moments",
    "text": "Bus small talk accidentally continues after both people get off. It turns out they’re heading directly to the same cafe.\n\nAs {name}: Pick a small-talk topic you can survive twice."
  },
  {
    "id": "p134",
    "category": "Awkward Moments",
    "text": "Two people claim the same birthday cake. There’s only one candle and neither budges.\n\nAs {name}: Invent the rule that awards first blow."
  },
  {
    "id": "p135",
    "category": "Awkward Moments",
    "text": "Someone introduces their houseplant by full name and résumé. The plant has apparently outlived several roommates.\n\nAs {name}: Ask one follow-up question about its previous employment."
  },
  {
    "id": "p136",
    "category": "Awkward Moments",
    "text": "The server says “enjoy,” and {name} replies “you too”. The server hasn’t left yet.\n\nAs {name}: Deliver the quickest possible recovery line."
  },
  {
    "id": "p137",
    "category": "Awkward Moments",
    "text": "A stranger asks for a pencil at a paperless event. There’s nothing to write on either.\n\nAs {name}: Offer a substitute and make it sound normal."
  },
  {
    "id": "p138",
    "category": "Awkward Moments",
    "text": "A friend mispronounces {name} three ways in one sentence. They pause and ask which version was right.\n\nAs {name}: Pick one to keep and honestly explain why."
  },
  {
    "id": "p139",
    "category": "Awkward Moments",
    "text": "Two people head in the same direction after saying goodbye. The shared sidewalk continues a whole block.\n\nAs {name}: Give the next goodbye a different style."
  },
  {
    "id": "p140",
    "category": "Awkward Moments",
    "text": "A friend hands over a gift and says “don’t read the label”. The label has a long paragraph in a tiny font.\n\nAs {name}: Guess the single word that made them warn you."
  },
  {
    "id": "p141",
    "category": "Awkward Moments",
    "text": "A party runs out of wristbands and gives out forehead stamps instead. Your next stop is a very quiet cafe.\n\nAs {name}: Explain the frog to the barista."
  },
  {
    "id": "p142",
    "category": "Awkward Moments",
    "text": "A host asks what {name} brings to the table while serving dinner. People are actively passing the bread basket.\n\nAs {name}: Answer their networking question literally."
  },
  {
    "id": "p143",
    "category": "Awkward Moments",
    "text": "A guest interprets make yourself at home by stretching flat on the rug. The host is about to carry snacks past them.\n\nAs {name}: Politely narrate the new floor arrangement."
  },
  {
    "id": "p144",
    "category": "Awkward Moments",
    "text": "Two guests reach discreetly for the last chair at once. Both friends insist they weren’t trying for it.\n\nAs {name}: Offer a fair and silly tiebreaker."
  },
  {
    "id": "p145",
    "category": "Awkward Moments",
    "text": "A stranger asks whether a favorite jacket comes in furniture sizes. The stranger is earnestly redecorating.\n\nAs {name}: Answer with a furniture item that could pull off your outfit."
  },
  {
    "id": "p146",
    "category": "Awkward Moments",
    "text": "A dress code reads “sort of formal”. Friends ask for a look that covers both a wedding and a doughnut run.\n\nAs {name}: Name your outfit."
  },
  {
    "id": "p147",
    "category": "Awkward Moments",
    "text": "Someone presents a homemade object and asks what it is. They look proud and you’re not sure whether it’s a bowl or a hat.\n\nAs {name}: Make your opening guess tactful."
  },
  {
    "id": "p148",
    "category": "Awkward Moments",
    "text": "A host uses a nickname nobody has ever called {name}. The host is delighted and everyone else joins in.\n\nAs {name}: Keep the nickname only if you can give it a backstory."
  },
  {
    "id": "p149",
    "category": "Awkward Moments",
    "text": "A waving stranger jogs toward {name} with a clipboard. They have almost reached you and the form says Opinions.\n\nAs {name}: Decide your first sentence."
  },
  {
    "id": "p150",
    "category": "Awkward Moments",
    "text": "A new neighbor greets {name} with “we’ve heard so much”. The neighbor refuses to clarify who said what.\n\nAs {name}: Ask which version of the story they heard."
  },
  {
    "id": "p151",
    "category": "Game Night",
    "text": "Youngest player starts but nobody will disclose a birthday. The game can’t start until someone volunteers.\n\nAs {name}: Pick a new starter rule that’s easy to verify."
  },
  {
    "id": "p152",
    "category": "Game Night",
    "text": "The scorekeeper writes “emotionally winning” beside {name}. You have actual points too, just not many.\n\nAs {name}: Make the scorekeeper defend their wording."
  },
  {
    "id": "p153",
    "category": "Game Night",
    "text": "The hourglass starts before anyone understands the instructions. Everyone freezes and looks at the timer.\n\nAs {name}: Announce a fair way to handle the lost seconds."
  },
  {
    "id": "p154",
    "category": "Game Night",
    "text": "A friend who’s never played immediately dominates. They ask the table how they’re doing after another perfect turn.\n\nAs {name}: Give them an affectionate competitive nickname."
  },
  {
    "id": "p155",
    "category": "Game Night",
    "text": "The bank charges forty pretend dollars to replace a tiny hat token. The hat is probably still under the couch.\n\nAs {name}: Argue your appeal to the tiny bank clerk."
  },
  {
    "id": "p156",
    "category": "Game Night",
    "text": "Someone mimes lighthouse by standing perfectly still. Ten seconds remain and guessing lighthouse would be a miracle.\n\nAs {name}: Yell a plausible wrong answer."
  },
  {
    "id": "p157",
    "category": "Game Night",
    "text": "Trivia asks for the capital of a nonexistent country. The host insists it’s not a typo.\n\nAs {name}: Make up a capital and one convincing fact about it."
  },
  {
    "id": "p158",
    "category": "Game Night",
    "text": "There are ten seconds to pick a team name. Every other team chose a reference you don’t know.\n\nAs {name}: Make up a name the group can shout."
  },
  {
    "id": "p159",
    "category": "Game Night",
    "text": "A card asks for a duel using only objects on the table. Your opponent already has the bowl.\n\nAs {name}: Propose a duel that uses what remains."
  },
  {
    "id": "p160",
    "category": "Game Night",
    "text": "Someone argues their answer counts because it rhymes with the right one. You’re the scorekeeper and the rhyme is genuinely excellent.\n\nAs {name}: Announce what you’ll award."
  },
  {
    "id": "p161",
    "category": "Game Night",
    "text": "The group drafts a sports team made of kitchen utensils. The whisk and tongs both want the same position.\n\nAs {name}: Explain your final lineup."
  },
  {
    "id": "p162",
    "category": "Game Night",
    "text": "Everyone has to propose a house rule. The room is competitive but nobody wants more math.\n\nAs {name}: Pitch a very simple rule that makes people laugh."
  },
  {
    "id": "p163",
    "category": "Game Night",
    "text": "A controller dies right as {name} crosses the finish line. The console has frozen your score one point short.\n\nAs {name}: Speak to the commentator as if this is a genuine scandal."
  },
  {
    "id": "p164",
    "category": "Game Night",
    "text": "A score dispute goes to a rubber-duck judge. No one has taught the duck to break ties.\n\nAs {name}: Give the most persuasive sentence you can say to it."
  },
  {
    "id": "p165",
    "category": "Game Night",
    "text": "The trophy is a wooden spoon on a shoelace. The losing team hands it to you with surprising ceremony.\n\nAs {name}: Deliver the opening of your speech."
  },
  {
    "id": "p166",
    "category": "Game Night",
    "text": "A tiebreaker names types of pasta and someone invents one. The host hands the mystery shape to you for verification.\n\nAs {name}: Give its fake regional origin."
  },
  {
    "id": "p167",
    "category": "Game Night",
    "text": "Two players use the same username and won’t change it. The score display can’t tell them apart.\n\nAs {name}: Announce what suffixes you’re adding."
  },
  {
    "id": "p168",
    "category": "Game Night",
    "text": "Someone treats a practice round as an official record. The group finds out they changed half the settings.\n\nAs {name}: Describe the record’s eligibility."
  },
  {
    "id": "p169",
    "category": "Game Night",
    "text": "Competitive Sitting needs a new rule. A friend insists slouching is doping.\n\nAs {name}: Write the one rule every sitter must follow."
  },
  {
    "id": "p170",
    "category": "Game Night",
    "text": "A Pictionary drawing is mistaken for an economic forecast. Everyone has stopped guessing and is worried about the economy.\n\nAs {name}: Explain your original drawing."
  },
  {
    "id": "p171",
    "category": "Game Night",
    "text": "Everyone chooses a household object for an avatar. Three people already picked the blanket.\n\nAs {name}: Choose a rival object and give it character."
  },
  {
    "id": "p172",
    "category": "Game Night",
    "text": "The game allows a custom elimination sound. Nobody wants to hear it every ten seconds.\n\nAs {name}: Pick the shortest sound that’s still funny."
  },
  {
    "id": "p173",
    "category": "Game Night",
    "text": "The player in last place asks for formal reassurance. The leader offers advice that makes it worse.\n\nAs {name}: Deliver a one-sentence victory-independent pep talk."
  },
  {
    "id": "p174",
    "category": "Game Night",
    "text": "A team earns zero points and celebrates like it won. Their celebration deserves acknowledgement.\n\nAs {name}: Invent an award that doesn’t change the score."
  },
  {
    "id": "p175",
    "category": "Game Night",
    "text": "The timer counts up instead of down. An argument breaks out about who gained time.\n\nAs {name}: Announce what the extra seconds are called."
  },
  {
    "id": "p176",
    "category": "Main Character",
    "text": "A missing pen deserves its own dramatic movie monologue. The actor has one shot before the room moves on.\n\nAs {name}: Give the pen its big dramatic moment."
  },
  {
    "id": "p177",
    "category": "Main Character",
    "text": "A slow-motion entrance has only a squeaky chair for the soundtrack. Everyone hears the sound and expects a reveal.\n\nAs {name}: Give the entrance the caption it deserves."
  },
  {
    "id": "p178",
    "category": "Main Character",
    "text": "The credits for {name}’s week start rolling. The credits must thank something nobody else noticed.\n\nAs {name}: Pick the unexpected contributor."
  },
  {
    "id": "p179",
    "category": "Main Character",
    "text": "A documentary crew follows {name} through a grocery store. The crew has used a tracking shot in the cereal aisle.\n\nAs {name}: Give the documentary its title."
  },
  {
    "id": "p180",
    "category": "Main Character",
    "text": "An actor needs to play a misplaced phone. Nobody is allowed to use a prop phone.\n\nAs {name}: Cast the role and direct the actor’s first reaction."
  },
  {
    "id": "p181",
    "category": "Main Character",
    "text": "A coffee spill wins a lifetime achievement award.\n\nAs {name}: The coffee spill can’t take the stage, so accept the award on its behalf."
  },
  {
    "id": "p182",
    "category": "Main Character",
    "text": "A narrator interrupts {name} to explain their motivation. The narrator got your motive hilariously wrong.\n\nAs {name}: Supply the correction they’ll have to dub in."
  },
  {
    "id": "p183",
    "category": "Main Character",
    "text": "A taco run gets an ominous movie trailer. The trailer can’t show the tacos yet.\n\nAs {name}: Write the ominous first thing the audience hears."
  },
  {
    "id": "p184",
    "category": "Main Character",
    "text": "{name} gets cast as Person Dramatically Holding an Object. The prop has to be within reach right now.\n\nAs {name}: Say what the film is actually about."
  },
  {
    "id": "p185",
    "category": "Main Character",
    "text": "Theme music starts during every fridge check. A friend opens the fridge too, and your music doesn’t stop.\n\nAs {name}: Name the genre of this scene."
  },
  {
    "id": "p186",
    "category": "Main Character",
    "text": "A tiny inconvenience merits an eight-part documentary. Viewers will only see the title of episode one.\n\nAs {name}: Make them feel ridiculous for wanting episode two."
  },
  {
    "id": "p187",
    "category": "Main Character",
    "text": "A household prop must establish that {name} is a supervillain. The audience is looking for a hint, not an entire costume.\n\nAs {name}: Choose what you hold and how you hold it."
  },
  {
    "id": "p188",
    "category": "Main Character",
    "text": "An extra gives away the ending by coughing dramatically. Your character is the only one who heard.\n\nAs {name}: Tell the extra what their cough just spoiled."
  },
  {
    "id": "p189",
    "category": "Main Character",
    "text": "Returning a sweater gets a full movie poster. The store clerk gets second billing.\n\nAs {name}: Write the tagline underneath your heroic pose."
  },
  {
    "id": "p190",
    "category": "Main Character",
    "text": "A reality show wants {name}’s most useless skill. The host says the talent has to be visible from the back row.\n\nAs {name}: Announce what the audience is about to see."
  },
  {
    "id": "p191",
    "category": "Main Character",
    "text": "An interviewer requests advice to {name}’s self from five minutes ago. You know exactly how little five minutes taught you.\n\nAs {name}: Deliver the most urgent advice anyway."
  },
  {
    "id": "p192",
    "category": "Main Character",
    "text": "Everyone freezes mid-musical except {name}. The chorus won’t move until the right cue.\n\nAs {name}: Sing the first line about something in the room."
  },
  {
    "id": "p193",
    "category": "Main Character",
    "text": "A director needs a voice for a confused pigeon. The pigeon has just recognized the person feeding it as an unrelated person.\n\nAs {name}: Voice its realization."
  },
  {
    "id": "p194",
    "category": "Main Character",
    "text": "A biopic exaggerates an ordinary Tuesday wildly. Your casting choice wants to know which minor task counts as your turning point.\n\nAs {name}: Name the scene."
  },
  {
    "id": "p195",
    "category": "Main Character",
    "text": "Taking out the trash gets its own classified codename. The household has to text you the codename when the bin is full.\n\nAs {name}: Give them a phrase they won’t regret."
  },
  {
    "id": "p196",
    "category": "Main Character",
    "text": "An optimistic haunted doormat needs a first line. The first visitor is at the door.\n\nAs {name}: Greet them like an encouraging object with an unfortunate history."
  },
  {
    "id": "p197",
    "category": "Main Character",
    "text": "A towel-folding video needs a surprise ending. The audience has not noticed that the towel is the wrong size.\n\nAs {name}: Invent the final twist."
  },
  {
    "id": "p198",
    "category": "Main Character",
    "text": "A camera catches the one expression {name} hoped nobody saw. The editor wants a sentence for the teaser.\n\nAs {name}: Give them a line that explains absolutely nothing."
  },
  {
    "id": "p199",
    "category": "Main Character",
    "text": "A random appliance noise replaces the walkout song. The crowd will hear it twice before you appear.\n\nAs {name}: Pick the noise that best builds suspense."
  },
  {
    "id": "p200",
    "category": "Main Character",
    "text": "A director demands more emotion in a line about parking validation. The parking ticket is already stamped.\n\nAs {name}: Deliver the line like the biggest revelation of your life."
  },
  {
    "id": "p201",
    "category": "Internet Nonsense",
    "text": "A five-second clip of {name} becomes a reaction GIF. The clip is now used for a situation it had nothing to do with.\n\nAs {name}: Describe the caption it deserves."
  },
  {
    "id": "p202",
    "category": "Internet Nonsense",
    "text": "The algorithm recommends only videos about tiny spoons. One video finally looks irresistible.\n\nAs {name}: Invent the title you would click without hesitation."
  },
  {
    "id": "p203",
    "category": "Internet Nonsense",
    "text": "A new podcast host hands {name} a spoon for a mic. Their first question is “where do we begin?”.\n\nAs {name}: Tell the audience why the spoon gets creative credit."
  },
  {
    "id": "p204",
    "category": "Internet Nonsense",
    "text": "A future historian requests the context for a meaningless meme. The historian thinks the meme was royal propaganda.\n\nAs {name}: Give it a fake historical footnote."
  },
  {
    "id": "p205",
    "category": "Internet Nonsense",
    "text": "An influencer launches a limited-edition box of nothing. A friend offers the empty box to you as a gift.\n\nAs {name}: Post an unboxing review."
  },
  {
    "id": "p206",
    "category": "Internet Nonsense",
    "text": "A filter adds a tiny halo to the wrong person. The person wearing it doesn’t know.\n\nAs {name}: Write the first comment that tells them why the halo fits."
  },
  {
    "id": "p207",
    "category": "Internet Nonsense",
    "text": "The comments demand an update on a situation resolved years ago. Nobody wants to admit nothing else happened.\n\nAs {name}: Post an update entertaining enough to end the thread."
  },
  {
    "id": "p208",
    "category": "Internet Nonsense",
    "text": "A tutorial promises to clean a room in fifteen seconds. The first fourteen seconds cover finding the thumbnail.\n\nAs {name}: Guess what the final second’s big trick will be."
  },
  {
    "id": "p209",
    "category": "Internet Nonsense",
    "text": "A livestream accidentally features only {name}’s elbow. People are somehow asking for part two.\n\nAs {name}: Name the stream and tease its next angle."
  },
  {
    "id": "p210",
    "category": "Internet Nonsense",
    "text": "A motivational newsletter asks for {name}’s biggest minor goal. You aren’t allowed to say anything about productivity.\n\nAs {name}: State a goal so small you might achieve it."
  },
  {
    "id": "p211",
    "category": "Internet Nonsense",
    "text": "A video called life changing stacks three cups. The third cup doesn’t even fit.\n\nAs {name}: Write the first oddly enthusiastic comment."
  },
  {
    "id": "p212",
    "category": "Internet Nonsense",
    "text": "A photo of an empty staircase has the caption “the squad”. The group agrees not to correct the caption.\n\nAs {name}: Give each stair a role in the squad photo."
  },
  {
    "id": "p213",
    "category": "Internet Nonsense",
    "text": "An app applauds {name} for opening it three days in a row. The app offers space for your own achievement badge.\n\nAs {name}: Name one more accurate accomplishment."
  },
  {
    "id": "p214",
    "category": "Internet Nonsense",
    "text": "An unboxing calls the purchase emotionally complex. The product looks like something from the clearance bin.\n\nAs {name}: Write the sentence that makes the purchase sound dramatic."
  },
  {
    "id": "p215",
    "category": "Internet Nonsense",
    "text": "Someone posts a dramatic apology for using a GIF too early. The GIF was a distracted frog.\n\nAs {name}: Quote the best line from the apology that never needed recording."
  },
  {
    "id": "p216",
    "category": "Internet Nonsense",
    "text": "A website asks people to identify all photos containing drama. You’re allowed to submit a photo of your own.\n\nAs {name}: Say what it depicts."
  },
  {
    "id": "p217",
    "category": "Internet Nonsense",
    "text": "The friends get one shared bio line across every app. The bio goes on every account including professional ones.\n\nAs {name}: Give everyone one sentence they could live with."
  },
  {
    "id": "p218",
    "category": "Internet Nonsense",
    "text": "A virtual background keeps changing to a dentist’s waiting room. The meeting has paused to address it.\n\nAs {name}: Leave a chat message naming the speciality this meeting seems to require."
  },
  {
    "id": "p219",
    "category": "Internet Nonsense",
    "text": "A day-in-my-life video starts at five in the afternoon. You have twelve minutes of footage left.\n\nAs {name}: Narrate the first decision of the alleged day."
  },
  {
    "id": "p220",
    "category": "Internet Nonsense",
    "text": "A plain selfie gets flagged as too powerful. The app lets you submit one appeal.\n\nAs {name}: Write why the image should be released back into the world."
  },
  {
    "id": "p221",
    "category": "Internet Nonsense",
    "text": "A chatbot asks for the emotional meaning of “k”. The bot wants one example sentence for its training.\n\nAs {name}: Give it the most accurate interpretation."
  },
  {
    "id": "p222",
    "category": "Internet Nonsense",
    "text": "A cliffhanger labeled part one never gets a part two. Friends refuse to leave until they hear an ending.\n\nAs {name}: Invent a follow-up title that sounds more fun than the original."
  },
  {
    "id": "p223",
    "category": "Internet Nonsense",
    "text": "{name} gets verified on an app that only tracks soup. Your profile needs a pinned achievement.\n\nAs {name}: Write the soup achievement you would brag about."
  },
  {
    "id": "p224",
    "category": "Internet Nonsense",
    "text": "An online checkout requests a tip on a digital receipt. There’s a field for a custom message.\n\nAs {name}: Tip the receipt with a piece of advice instead of money."
  },
  {
    "id": "p225",
    "category": "Internet Nonsense",
    "text": "A post goes viral with twelve views. They need a quote for their “thanks for all the love” screenshot.\n\nAs {name}: Write the shortest message that won’t encourage a sequel."
  },
  {
    "id": "p226",
    "category": "Wrong Answers Only",
    "text": "A fortune cookie simply says “Absolutely not”. There’s no fortune on the other side.\n\nAs {name}: Say what silent question you think the cookie just answered."
  },
  {
    "id": "p227",
    "category": "Wrong Answers Only",
    "text": "A trophy says Second Place in Something. The trophy is on your kitchen counter and a visitor asks why.\n\nAs {name}: Invent the competition you almost won."
  },
  {
    "id": "p228",
    "category": "Wrong Answers Only",
    "text": "A museum displays a phone charger without a plaque. The museum gives you one blank line.\n\nAs {name}: Add a caption about its alleged historical purpose."
  },
  {
    "id": "p229",
    "category": "Wrong Answers Only",
    "text": "A doorbell has buttons for Yes, No, and Probably. A guest has to press one and can’t see the homeowner.\n\nAs {name}: Say what question you think you’re answering."
  },
  {
    "id": "p230",
    "category": "Wrong Answers Only",
    "text": "A hotel map has a room called The Mood. The concierge refuses to elaborate.\n\nAs {name}: Describe what you’d expect right through that door."
  },
  {
    "id": "p231",
    "category": "Wrong Answers Only",
    "text": "A receipt lists an Unidentified Unit of Joy. It was the only item you were billed for.\n\nAs {name}: Announce what emotional purchase it must describe."
  },
  {
    "id": "p232",
    "category": "Wrong Answers Only",
    "text": "A remote has an Undo Tuesday button. It’s nearly midnight and nobody remembers what went wrong on Tuesday.\n\nAs {name}: Guess the first thing the button will undo."
  },
  {
    "id": "p233",
    "category": "Wrong Answers Only",
    "text": "The bus destination display reads NOT YET. The driver nods when you ask if this is a real route.\n\nAs {name}: Explain where this bus is going."
  },
  {
    "id": "p234",
    "category": "Wrong Answers Only",
    "text": "A book called Instructions for a Circle lacks the final chapter. You’re asked to help finish the reprint.\n\nAs {name}: Suggest what the missing chapter used to be called."
  },
  {
    "id": "p235",
    "category": "Wrong Answers Only",
    "text": "An empty beach chair has a note reading “you know why”. It’s perfectly good and the tide is coming in.\n\nAs {name}: Guess what its owner wanted to warn you about."
  },
  {
    "id": "p236",
    "category": "Wrong Answers Only",
    "text": "A key has the inscription “only in an emergency”. The key opens something in your bag, not your house.\n\nAs {name}: Name its one intended emergency."
  },
  {
    "id": "p237",
    "category": "Wrong Answers Only",
    "text": "A mall directory labels a kiosk A Situation. The neighboring stores are entirely ordinary.\n\nAs {name}: Tell the group what this kiosk must sell."
  },
  {
    "id": "p238",
    "category": "Wrong Answers Only",
    "text": "The freezer section is marked Regrets. The shelf underneath is labeled, but the label has frozen off.\n\nAs {name}: Name the kind of purchase you expect there."
  },
  {
    "id": "p239",
    "category": "Wrong Answers Only",
    "text": "A parade is held for a mystery appliance. Residents vote for the appliance that had the strongest year.\n\nAs {name}: Nominate a winner and a reason."
  },
  {
    "id": "p240",
    "category": "Wrong Answers Only",
    "text": "An encyclopedia entry is entirely covered by sticky notes. The notes all say “do not read aloud”.\n\nAs {name}: Guess the harmless subject that caused this level of caution."
  },
  {
    "id": "p241",
    "category": "Wrong Answers Only",
    "text": "An ancient inscription reads “Just circle back”. The museum hopes it’s a riddle.\n\nAs {name}: Give the official translation of this mysterious phrase."
  },
  {
    "id": "p242",
    "category": "Wrong Answers Only",
    "text": "An account statement credits an imaginary dollar. The account will close in an hour.\n\nAs {name}: Say where an imaginary fortune can be spent."
  },
  {
    "id": "p243",
    "category": "Wrong Answers Only",
    "text": "A timer goes off in an empty kitchen. Everyone runs in expecting dinner.\n\nAs {name}: Announce which dish the unseen cook just finished."
  },
  {
    "id": "p244",
    "category": "Wrong Answers Only",
    "text": "A package arrives addressed to The Reason. Your name is printed as the sender.\n\nAs {name}: Tell the confused recipient what you think you mailed."
  },
  {
    "id": "p245",
    "category": "Wrong Answers Only",
    "text": "A hat says CERTIFIED ORIGINAL. The shop says every hat certifies something different.\n\nAs {name}: Say what test this particular one passed."
  },
  {
    "id": "p246",
    "category": "Wrong Answers Only",
    "text": "A menu only lists The Usual. All the other diners claim they got something different.\n\nAs {name}: Order your own suspiciously specific usual."
  },
  {
    "id": "p247",
    "category": "Wrong Answers Only",
    "text": "An old board game contains one card titled Consequence. It’s the only card nobody’s drawn yet.\n\nAs {name}: Say what consequence should be printed on the other side."
  },
  {
    "id": "p248",
    "category": "Wrong Answers Only",
    "text": "A fountain has a No Wishing sign. You find a single coin next to the sign.\n\nAs {name}: Imagine which wish led to this rule."
  },
  {
    "id": "p249",
    "category": "Wrong Answers Only",
    "text": "A gallery has a single shoe taped to its ceiling. Someone asks the name of the movement before buying the piece.\n\nAs {name}: Invent one that makes the tape sound significant."
  },
  {
    "id": "p250",
    "category": "Wrong Answers Only",
    "text": "A coworking space opens a room named The Last Straw. The office manager begs you to book it but won’t open the door.\n\nAs {name}: Guess what it’s actually decorated with."
  },
  {
    "id": "p251",
    "category": "Tiny Businesses",
    "text": "A startup sells the sound of opening chips.\n\nAs {name}: Prove the concept with a sound the audience can make themselves."
  },
  {
    "id": "p252",
    "category": "Tiny Businesses",
    "text": "A blanket boutique needs to justify a $400 price. The price tag has room for four words.\n\nAs {name}: Write them."
  },
  {
    "id": "p253",
    "category": "Tiny Businesses",
    "text": "A gym trains people to carry all the groceries in one trip.\n\nAs {name}: The class needs a title that sounds like a real fitness class."
  },
  {
    "id": "p254",
    "category": "Tiny Businesses",
    "text": "A restaurant serves all drinks in measuring cups. The bartender calls them precision glassware.\n\nAs {name}: Describe your most expensive drink."
  },
  {
    "id": "p255",
    "category": "Tiny Businesses",
    "text": "A museum collects things no one meant to keep. The first exhibit has to fit in a drawer.\n\nAs {name}: Write its plaque."
  },
  {
    "id": "p256",
    "category": "Tiny Businesses",
    "text": "A company rents the table extra elbow room. A diner needs to declare which side they’re renting.\n\nAs {name}: Make the fine print funny."
  },
  {
    "id": "p257",
    "category": "Tiny Businesses",
    "text": "A hotel lets people order unusual alarm sounds. The reception desk only has three sounds so far.\n\nAs {name}: Add the most effective one."
  },
  {
    "id": "p258",
    "category": "Tiny Businesses",
    "text": "A bakery opens in a bank vault.\n\nAs {name}: Make a pastry name that shows off the old teller window."
  },
  {
    "id": "p259",
    "category": "Tiny Businesses",
    "text": "A bookstore sorts novels by awkwardness to read in public. The shelf right next to the entrance is empty.\n\nAs {name}: Give it an uncomfortable category."
  },
  {
    "id": "p260",
    "category": "Tiny Businesses",
    "text": "A detective agency only finds water bottles. Someone claims their bottle “went off the grid”.\n\nAs {name}: Write the firm’s ad copy."
  },
  {
    "id": "p261",
    "category": "Tiny Businesses",
    "text": "A vending machine takes compliments instead of money. You have one compliment and the machine has a skeptical voice.\n\nAs {name}: Get the snack."
  },
  {
    "id": "p262",
    "category": "Tiny Businesses",
    "text": "A pop-up sells one sock at a time. The second sock costs extra.\n\nAs {name}: Sell customers on wearing only the first."
  },
  {
    "id": "p263",
    "category": "Tiny Businesses",
    "text": "A spokesperson makes folding chairs aspirational.\n\nAs {name}: Give the folding chair a tagline you’d put on an expensive billboard."
  },
  {
    "id": "p264",
    "category": "Tiny Businesses",
    "text": "A subscription box sends one average rock every month. The premium box has the same rock plus one perk.\n\nAs {name}: Invent the perk."
  },
  {
    "id": "p265",
    "category": "Tiny Businesses",
    "text": "A cafe charges people to sit in silence together. The window has space for one sentence of rules.\n\nAs {name}: Write the sign."
  },
  {
    "id": "p266",
    "category": "Tiny Businesses",
    "text": "A shop dresses people for surprise video calls. The customer only needs to look put-together above their shoulders.\n\nAs {name}: Name the bestseller."
  },
  {
    "id": "p267",
    "category": "Tiny Businesses",
    "text": "A company tests pillows in public. The interviewer asks for your greatest weakness.\n\nAs {name}: Answer like you desperately want the pillow job."
  },
  {
    "id": "p268",
    "category": "Tiny Businesses",
    "text": "A theme park consists entirely of queues. The owner wants a hero attraction to put on posters.\n\nAs {name}: Name and describe the queue."
  },
  {
    "id": "p269",
    "category": "Tiny Businesses",
    "text": "A laundromat rewards people who forget their socks. Someone has earned ten stamps without retrieving a sock.\n\nAs {name}: Tell them what they’ve won."
  },
  {
    "id": "p270",
    "category": "Tiny Businesses",
    "text": "A store sells little trophies for ordinary tasks. A display window can show one very specific achievement.\n\nAs {name}: Choose what it celebrates."
  },
  {
    "id": "p271",
    "category": "Tiny Businesses",
    "text": "A luxury dealership sells shopping carts. The salesperson opens the trunk of the world’s smallest cart.\n\nAs {name}: Name its luxury feature."
  },
  {
    "id": "p272",
    "category": "Tiny Businesses",
    "text": "A farmers market booth opens without a product. The stall opens in two minutes and has a handwritten sign.\n\nAs {name}: Decide what it says."
  },
  {
    "id": "p273",
    "category": "Tiny Businesses",
    "text": "A roller rink enforces no fun. The jukebox plays one song but dancing is still forbidden.\n\nAs {name}: Pitch a better policy."
  },
  {
    "id": "p274",
    "category": "Tiny Businesses",
    "text": "A shop sells used excuses. An entire shelf is full of excuses for being late.\n\nAs {name}: Name the top seller."
  },
  {
    "id": "p275",
    "category": "Tiny Businesses",
    "text": "A ride-share app transports houseplants. The delivery driver needs a system for classifying passengers.\n\nAs {name}: Write the rating for a cactus."
  },
  {
    "id": "p276",
    "category": "Public Office",
    "text": "The mayor needs a new low-stakes public holiday. The parade budget is already spent.\n\nAs {name}: Announce an observance everyone can do for free."
  },
  {
    "id": "p277",
    "category": "Public Office",
    "text": "The city renames its least scenic street. Nobody can change the street itself.\n\nAs {name}: Pick a new name that makes the view sound better."
  },
  {
    "id": "p278",
    "category": "Public Office",
    "text": "The key to the city comes with no instructions. The unveiling has cameras and one very ordinary door nearby.\n\nAs {name}: Tell the mayor what you plan to unlock."
  },
  {
    "id": "p279",
    "category": "Public Office",
    "text": "The annual budget has exactly one dollar left over. The finance director demands a line item that comes in under budget.\n\nAs {name}: Propose the purchase."
  },
  {
    "id": "p280",
    "category": "Public Office",
    "text": "The council votes on the official nap duration. The committee includes someone who sleeps through every alarm.\n\nAs {name}: Give a duration with one exception."
  },
  {
    "id": "p281",
    "category": "Public Office",
    "text": "Every resident must take one unnecessary training course. Nobody can pass on attendance alone.\n\nAs {name}: Give this course a ridiculous final exam."
  },
  {
    "id": "p282",
    "category": "Public Office",
    "text": "The library quiet room needs a new sign. The librarian is tired of warnings that nobody reads.\n\nAs {name}: Write one people will quote."
  },
  {
    "id": "p283",
    "category": "Public Office",
    "text": "The mayor wants to fine residents for vague plans. The first summons is for saying “we should hang soon”.\n\nAs {name}: Hand down a fair penalty."
  },
  {
    "id": "p284",
    "category": "Public Office",
    "text": "The town needs an official handshake. The introduction must be possible while holding snacks.\n\nAs {name}: Demonstrate the final move."
  },
  {
    "id": "p285",
    "category": "Public Office",
    "text": "The new statue has no inscription. Nobody knows who the statue actually represents.\n\nAs {name}: Write something that could plausibly fit."
  },
  {
    "id": "p286",
    "category": "Public Office",
    "text": "The city wants a wild animal mascot with no majesty. The mascot has to look good on a flag.\n\nAs {name}: Nominate a real animal that can pull it off."
  },
  {
    "id": "p287",
    "category": "Public Office",
    "text": "The flag can use three emojis. The designer wants a meaning for each icon.\n\nAs {name}: Pick the three and defend your combination."
  },
  {
    "id": "p288",
    "category": "Public Office",
    "text": "The town hall debate is whether sofas belong outdoors. You get one minute before the council votes.\n\nAs {name}: Make a case that includes the rain forecast."
  },
  {
    "id": "p289",
    "category": "Public Office",
    "text": "The ice cream truck needs a new jingle. The driver is tired of the current tune.\n\nAs {name}: Supply a new sound they can tolerate all day."
  },
  {
    "id": "p290",
    "category": "Public Office",
    "text": "One minor offense can be pardoned for the entire city. You can’t pardon actual crimes, just a minor social offense.\n\nAs {name}: Announce what people can stop apologizing for."
  },
  {
    "id": "p291",
    "category": "Public Office",
    "text": "The public hotline is for very unimportant emergencies. The hotline operator has one minute for each call.\n\nAs {name}: Report the inconvenience as an emergency."
  },
  {
    "id": "p292",
    "category": "Public Office",
    "text": "The billboard needs one useless but true tip. The sign is on a slow road.\n\nAs {name}: Give drivers something funny enough to read at a red light."
  },
  {
    "id": "p293",
    "category": "Public Office",
    "text": "The judge must sentence a squeaky bicycle. The bike owner swears the squeak is “character”.\n\nAs {name}: Sentence the bicycle and spare the owner."
  },
  {
    "id": "p294",
    "category": "Public Office",
    "text": "A parade celebrates whatever {name} just did. The crowd needs one banner large enough to read.\n\nAs {name}: Write the ceremonial slogan for what you did last."
  },
  {
    "id": "p295",
    "category": "Public Office",
    "text": "The fountain needs a sound to play per coin. The fountain sits near quiet apartments.\n\nAs {name}: Choose a sound that earns repeat coins without complaints."
  },
  {
    "id": "p296",
    "category": "Public Office",
    "text": "There is a severe weather alert for light drizzle. A TV crew asks whether to move people indoors.\n\nAs {name}: Make the emergency announcement."
  },
  {
    "id": "p297",
    "category": "Public Office",
    "text": "The chaotic sidewalk needs an award. Half the sidewalk is blocked by a sandwich board.\n\nAs {name}: Name the award and thank its contributors."
  },
  {
    "id": "p298",
    "category": "Public Office",
    "text": "The ceremonial speech must end with a household chore. You’re out of dignitaries to thank.\n\nAs {name}: Turn a chore into your final call to action."
  },
  {
    "id": "p299",
    "category": "Public Office",
    "text": "A plaque on the street must commemorate something forgettable. The neighbors just want to remember what goes wrong on Tuesdays.\n\nAs {name}: Write a real-sounding inscription."
  },
  {
    "id": "p300",
    "category": "Public Office",
    "text": "The city motto has to be aggressively average. The townspeople will have to say it every morning.\n\nAs {name}: Make mediocrity feel worth showing up for."
  },
  {
    "id": "p301",
    "category": "Superpowers",
    "text": "Teleportation works only to gift shops. You get one test trip and can’t buy anything once you return.\n\nAs {name}: Name the gift shop you land in."
  },
  {
    "id": "p302",
    "category": "Superpowers",
    "text": "Animals can talk only about recycling. A raccoon asks which bin its snack wrapper goes in.\n\nAs {name}: Give it a serious answer."
  },
  {
    "id": "p303",
    "category": "Superpowers",
    "text": "Time can be paused seven seconds a day. Your friend is about to click send on a group-wide typo.\n\nAs {name}: Pick a useful seven-second intervention."
  },
  {
    "id": "p304",
    "category": "Superpowers",
    "text": "Magic summons anything as long as it’s a bowl. Someone has lost their keys at a picnic.\n\nAs {name}: Choose a bowl with a practical or ridiculous use."
  },
  {
    "id": "p305",
    "category": "Superpowers",
    "text": "Every ordinary object can be used as a phone for a minute. Your actual phone is dead in a public place.\n\nAs {name}: Choose your substitute and say the first thing you’d say into it."
  },
  {
    "id": "p306",
    "category": "Superpowers",
    "text": "Flying works exactly four inches off the ground. There’s a long line between you and the exit.\n\nAs {name}: Explain the most modest benefit of hovering."
  },
  {
    "id": "p307",
    "category": "Superpowers",
    "text": "The cape makes the wearer look ten percent more prepared. A friend invited you to an event whose dress code you didn’t read.\n\nAs {name}: Decide how dramatically you reveal the cape."
  },
  {
    "id": "p308",
    "category": "Superpowers",
    "text": "Turning invisible leaves shoes visible. There’s a long hallway and your shoes are unmistakable.\n\nAs {name}: Invent the story witnesses will tell."
  },
  {
    "id": "p309",
    "category": "Superpowers",
    "text": "Mind reading only works while someone thinks of lunch. A friend is staring at the menu but won’t choose.\n\nAs {name}: Ask the first question you can answer yourself."
  },
  {
    "id": "p310",
    "category": "Superpowers",
    "text": "A sticker makes any object work better. One important kitchen gadget keeps letting everyone down.\n\nAs {name}: Put the sticker somewhere more unexpected."
  },
  {
    "id": "p311",
    "category": "Superpowers",
    "text": "Walking through walls only works while humming. Someone behind the wall will hear you coming.\n\nAs {name}: Choose the last tune they’d expect."
  },
  {
    "id": "p312",
    "category": "Superpowers",
    "text": "Any object can shrink to fit into a pocket. You’re allowed one item and the pocket returns it to full size on demand.\n\nAs {name}: Pack something useful enough to justify the power."
  },
  {
    "id": "p313",
    "category": "Superpowers",
    "text": "Chairs voice their opinions. Your chair has been judging the evening in silence.\n\nAs {name}: Supply the first line you hear it say."
  },
  {
    "id": "p314",
    "category": "Superpowers",
    "text": "A magic remote lets one skip a type of errand. The remote deletes the task from your calendar but not from reality.\n\nAs {name}: Pick an errand you can truly afford to skip."
  },
  {
    "id": "p315",
    "category": "Superpowers",
    "text": "Missing objects can glow one color. Several people lose chargers at the same party.\n\nAs {name}: Pick a color and say what mistaken identity it could cause."
  },
  {
    "id": "p316",
    "category": "Superpowers",
    "text": "Strength only works on decorative things. The adults need help moving things but most furniture is functional.\n\nAs {name}: Find the one job that this gift actually qualifies for."
  },
  {
    "id": "p317",
    "category": "Superpowers",
    "text": "A signal in the sky can summon help for a tiny inconvenience. You want the signal to be unmistakable without frightening anyone.\n\nAs {name}: Design its symbol for one very small crisis."
  },
  {
    "id": "p318",
    "category": "Superpowers",
    "text": "A dramatic breeze can be summoned indoors. The breeze lasts two seconds and can’t cool the room.\n\nAs {name}: Pick the best dramatic cue for it."
  },
  {
    "id": "p319",
    "category": "Superpowers",
    "text": "A snack bowl refills upon hearing a catchphrase. The bowl is empty before the movie starts.\n\nAs {name}: Use the phrase you’re willing to say in front of everyone."
  },
  {
    "id": "p320",
    "category": "Superpowers",
    "text": "An annoying noise can be replaced with applause. You’re only allowed one irreversible pick.\n\nAs {name}: Give one noise the applause treatment and describe the result."
  },
  {
    "id": "p321",
    "category": "Superpowers",
    "text": "One object can be muted forever. Somebody will keep using the object daily.\n\nAs {name}: Name the sound you’d remove without ruining its purpose."
  },
  {
    "id": "p322",
    "category": "Superpowers",
    "text": "A mirror compliments only shoes. The mirror wants your first question to be very specific.\n\nAs {name}: Ask for one honest footwear opinion."
  },
  {
    "id": "p323",
    "category": "Superpowers",
    "text": "A person can spin an object a quarter-turn with a thought. People are watching and the object makes no noise.\n\nAs {name}: Choose the most unsettling ninety-degree turn."
  },
  {
    "id": "p324",
    "category": "Superpowers",
    "text": "Time travel reaches only three seconds into the future. The gift is available all dinner.\n\nAs {name}: Pick the tiny contest you can suddenly win every time."
  },
  {
    "id": "p325",
    "category": "Superpowers",
    "text": "A sidekick has the exact ability to make perfect toast. The sidekick insists on equal credit.\n\nAs {name}: Invent the mission where their special breakfast power comes in handy."
  },
  {
    "id": "p326",
    "category": "Pets and Plants",
    "text": "A dog occupies the best chair and will not negotiate. The chair is meant for a guest arriving any minute.\n\nAs {name}: Make the dog an offer good enough to move."
  },
  {
    "id": "p327",
    "category": "Pets and Plants",
    "text": "A houseplant fan club needs merchandise. The preorder form needs one item and a catchy name.\n\nAs {name}: Give the fans something absurdly specific."
  },
  {
    "id": "p328",
    "category": "Pets and Plants",
    "text": "A pet fish is getting a surprise party. The guests can’t clap too loudly and food has to be aquarium-safe.\n\nAs {name}: Name the main activity."
  },
  {
    "id": "p329",
    "category": "Pets and Plants",
    "text": "The neighbor’s cat stares into a window like a landlord. You can see it inspecting the room.\n\nAs {name}: Tell it which part of the lease it should worry about."
  },
  {
    "id": "p330",
    "category": "Pets and Plants",
    "text": "A parrot can memorize one sentence from game night. It will repeat the phrase whenever guests arrive.\n\nAs {name}: Write the line you’re willing to live with."
  },
  {
    "id": "p331",
    "category": "Pets and Plants",
    "text": "Tiny paw prints appear on a freshly painted wall. The painter wants to hang a little label beside the marks.\n\nAs {name}: Give the art a name."
  },
  {
    "id": "p332",
    "category": "Pets and Plants",
    "text": "The dog runs for household president. You have one job as campaign manager.\n\nAs {name}: Write a promise the dog can plausibly fulfill."
  },
  {
    "id": "p333",
    "category": "Pets and Plants",
    "text": "A cucumber grows into a geometrically perfect cube. The neighbors insist it must have its own name before it’s chopped.\n\nAs {name}: Introduce it."
  },
  {
    "id": "p334",
    "category": "Pets and Plants",
    "text": "The cat and the vacuum are in a standoff. The vacuum requests an impartial ruling.\n\nAs {name}: Announce who owns this corner of the living room."
  },
  {
    "id": "p335",
    "category": "Pets and Plants",
    "text": "A hamster gets one whimsical luxury apartment upgrade. The hamster already has a wheel and water.\n\nAs {name}: Add the most unnecessary upgrade it could still use."
  },
  {
    "id": "p336",
    "category": "Pets and Plants",
    "text": "A bird keeps landing on the same sign. Only one word on the sign seems important to the bird.\n\nAs {name}: Guess what message it’s sending."
  },
  {
    "id": "p337",
    "category": "Pets and Plants",
    "text": "A friend says their pet has a complicated relationship with gravity. The pet is fine but a throw pillow has been moved.\n\nAs {name}: Reconstruct what probably occurred."
  },
  {
    "id": "p338",
    "category": "Pets and Plants",
    "text": "An app says the fern is disappointed. You can’t water it again today.\n\nAs {name}: Apologize to the plant without promising anything you can’t deliver."
  },
  {
    "id": "p339",
    "category": "Pets and Plants",
    "text": "The dog steals a sock during a formal dinner. Everyone wants the sock back before dessert.\n\nAs {name}: Offer a trade the dog might seriously consider."
  },
  {
    "id": "p340",
    "category": "Pets and Plants",
    "text": "A fish in a public aquarium follows {name}. The fish ignores everybody else.\n\nAs {name}: Confide the one thing it seems most likely to understand."
  },
  {
    "id": "p341",
    "category": "Pets and Plants",
    "text": "A raccoon arrives at a picnic like it has a booking. It stops right at the edge of the blanket.\n\nAs {name}: Greet it like a guest who is slightly early."
  },
  {
    "id": "p342",
    "category": "Pets and Plants",
    "text": "The pet cam shows a dog claiming the entire laundry basket. The owner wants a caption for the footage.\n\nAs {name}: Explain what the dog is staging in there."
  },
  {
    "id": "p343",
    "category": "Pets and Plants",
    "text": "A squirrel drops an acorn into {name}’s cup. The drink is not for tasting.\n\nAs {name}: Name it like a fancy mocktail the squirrel just invented."
  },
  {
    "id": "p344",
    "category": "Pets and Plants",
    "text": "The label falls off a mystery sprout. The gardener needs a temporary label that won’t imply what it is.\n\nAs {name}: Give it a name."
  },
  {
    "id": "p345",
    "category": "Pets and Plants",
    "text": "A rabbit photo becomes the party invitation by accident. It’s too late to resend the invite.\n\nAs {name}: Announce the party theme that makes the photo make sense."
  },
  {
    "id": "p346",
    "category": "Pets and Plants",
    "text": "A new leaf gets a naming ceremony. You get one minute at the windowsill.\n\nAs {name}: Deliver the name and a ceremonial line."
  },
  {
    "id": "p347",
    "category": "Pets and Plants",
    "text": "A pet needs a costume for the neighborhood parade. The pet hates hats and won’t stand still.\n\nAs {name}: Design an outfit they can actually move in."
  },
  {
    "id": "p348",
    "category": "Pets and Plants",
    "text": "The sitter leaves a report titled An Incident Occurred. The report is several pages but the pet looks smug.\n\nAs {name}: Predict the first sentence."
  },
  {
    "id": "p349",
    "category": "Pets and Plants",
    "text": "A tortoise escapes and travels two feet. The rescue team arrived just as it settled in for a break.\n\nAs {name}: Recount the pursuit like a sports highlight."
  },
  {
    "id": "p350",
    "category": "Pets and Plants",
    "text": "A cactus comes with a diary and requests updates. The owner says it values daily praise.\n\nAs {name}: Write the first line in its diary without inventing new growth."
  },
  {
    "id": "p351",
    "category": "Odd Jobs",
    "text": "A producer casts competitive suitcase packers. The final challenge is a soft bag and one oddly large hat.\n\nAs {name}: Explain your winning method like a contestant."
  },
  {
    "id": "p352",
    "category": "Odd Jobs",
    "text": "A company wants an ad for a completely ordinary mug. Your ad may not mention what mugs normally do.\n\nAs {name}: Give the product a sales line anyway."
  },
  {
    "id": "p353",
    "category": "Odd Jobs",
    "text": "Investors want a one-word pitch for a weekend plan. The plan would keep you indoors all afternoon.\n\nAs {name}: Pitch it in a word worth repeating."
  },
  {
    "id": "p354",
    "category": "Odd Jobs",
    "text": "A speaker gets one minute to teach something they learned that day. The topic should be too small for a conventional talk.\n\nAs {name}: Give the talk’s title and its main conclusion."
  },
  {
    "id": "p355",
    "category": "Odd Jobs",
    "text": "A tailor tries selling someone a sweater they already have on. They think it might be a mistake to pay twice.\n\nAs {name}: Give them a reason your version is worth it."
  },
  {
    "id": "p356",
    "category": "Odd Jobs",
    "text": "A float for a parade starts with one empty grocery cart. The grandstand will only see one cart, no props.\n\nAs {name}: Announce the float’s title over the PA."
  },
  {
    "id": "p357",
    "category": "Odd Jobs",
    "text": "A panel must approve reorganizing a drawer at midnight. The panel thinks it can wait until morning.\n\nAs {name}: Explain why this particular drawer absolutely cannot."
  },
  {
    "id": "p358",
    "category": "Odd Jobs",
    "text": "A niche comedy festival needs a name. There are only three acts and they all know each other.\n\nAs {name}: Name the festival so the poster feels real."
  },
  {
    "id": "p359",
    "category": "Odd Jobs",
    "text": "A heist movie needs a worthless target. The security guard doesn’t care about it either.\n\nAs {name}: Name the object with the funniest getaway scene."
  },
  {
    "id": "p360",
    "category": "Odd Jobs",
    "text": "A gym has to sell members on taking stairs. Customers need a reason to take the stairs on a Monday.\n\nAs {name}: Give the voice-over its best shot."
  },
  {
    "id": "p361",
    "category": "Odd Jobs",
    "text": "A computer tab asks for a better title than Untitled. There are twelve tabs with the same title.\n\nAs {name}: Give this one a name you can always find again."
  },
  {
    "id": "p362",
    "category": "Odd Jobs",
    "text": "A dramatic memoir recounts an uneventful life. The cover shows you looking thoughtful by a sink.\n\nAs {name}: Write the title."
  },
  {
    "id": "p363",
    "category": "Odd Jobs",
    "text": "A group applies to adopt a giant beanbag. The committee wants to know who will walk it.\n\nAs {name}: Make a promise to look after your new beanbag."
  },
  {
    "id": "p364",
    "category": "Odd Jobs",
    "text": "A candle radio ad can use only one sound. Choose a sound listeners can picture immediately.\n\nAs {name}: Explain what scent that sound is meant to suggest."
  },
  {
    "id": "p365",
    "category": "Odd Jobs",
    "text": "An ordinary hobby gets sponsorship. The brand requires a public statement.\n\nAs {name}: Name the sponsor and the ordinary thing they’re helping you do."
  },
  {
    "id": "p366",
    "category": "Odd Jobs",
    "text": "An unusually useful string needs a spokesperson. The string is short and has one knot.\n\nAs {name}: Show off the feature that makes it sound indispensable."
  },
  {
    "id": "p367",
    "category": "Odd Jobs",
    "text": "A detective show solves every case by asking the same person. There’s a generous budget but only one recurring witness.\n\nAs {name}: Name the show and the detective’s signature question."
  },
  {
    "id": "p368",
    "category": "Odd Jobs",
    "text": "A beverage company wants to market lukewarm water. You can’t call it refreshing or cold.\n\nAs {name}: Give nobody a reason to look for ice."
  },
  {
    "id": "p369",
    "category": "Odd Jobs",
    "text": "A billboard endorses one minor convenience. The slogan can have six words.\n\nAs {name}: Choose an everyday convenience you’d actually endorse."
  },
  {
    "id": "p370",
    "category": "Odd Jobs",
    "text": "A clock always showing “Soon” needs a pitch. People think the clock is broken.\n\nAs {name}: Sell them on a useful situation for it."
  },
  {
    "id": "p371",
    "category": "Odd Jobs",
    "text": "A planner sells tickets to a silent talent show. The event is tonight and the audience can’t applaud aloud.\n\nAs {name}: Write what the listing promises."
  },
  {
    "id": "p372",
    "category": "Odd Jobs",
    "text": "A game-show prize must have no resale value. The winner gets a dramatic reveal but no money.\n\nAs {name}: Name a prize they’d keep anyway."
  },
  {
    "id": "p373",
    "category": "Odd Jobs",
    "text": "A tour company promotes a mystery detour. The driver will keep going unless guests vote yes.\n\nAs {name}: Use one line to sell the unknown."
  },
  {
    "id": "p374",
    "category": "Odd Jobs",
    "text": "A cereal box needs an impossible puzzle. The brand needs a cheerful instruction that can never quite be completed.\n\nAs {name}: Write it."
  },
  {
    "id": "p375",
    "category": "Odd Jobs",
    "text": "The best personality trait has to be listed as a side effect. The ad has to close with the side-effects disclaimer.\n\nAs {name}: Make yours sound dangerously specific."
  },
  {
    "id": "p376",
    "category": "Tech Glitches",
    "text": "Autocorrect replaces yes with “per my previous email”. A friend asks if you can bring napkins.\n\nAs {name}: Send the most polite workaround you can."
  },
  {
    "id": "p377",
    "category": "Tech Glitches",
    "text": "A voice assistant interprets a sigh as a command. The assistant asks which room to start in.\n\nAs {name}: Name the task it must have misunderstood."
  },
  {
    "id": "p378",
    "category": "Tech Glitches",
    "text": "The front camera permanently switches to 0.5x. The next photo has to be of you in a crowded cafe.\n\nAs {name}: Invent the best use of that dramatic perspective."
  },
  {
    "id": "p379",
    "category": "Tech Glitches",
    "text": "The smart fridge sends a passive-aggressive warning. Nothing in the fridge looks different.\n\nAs {name}: Read the notification and give it a one-line reply."
  },
  {
    "id": "p380",
    "category": "Tech Glitches",
    "text": "Speakers must be named after what they actually play. Yours gets paired at parties.\n\nAs {name}: Rename it after the last track people hear there."
  },
  {
    "id": "p381",
    "category": "Tech Glitches",
    "text": "A printer asks for a second opinion. It holds the paper halfway out until advised.\n\nAs {name}: Tell it which person you’d recruit to settle this."
  },
  {
    "id": "p382",
    "category": "Tech Glitches",
    "text": "The calendar schedules a meeting titled Thinking About It. The invite blocks a completely normal afternoon.\n\nAs {name}: Accept or decline with the smallest reason you can state."
  },
  {
    "id": "p383",
    "category": "Tech Glitches",
    "text": "The screen time report includes handwritten feedback. You can’t appeal the hours, but you can disagree with the comment.\n\nAs {name}: Write it and your comeback."
  },
  {
    "id": "p384",
    "category": "Tech Glitches",
    "text": "A smartwatch calls dishwashing a competitive sport. It presents a medal for your dishwashing style.\n\nAs {name}: Give the sportscaster its name."
  },
  {
    "id": "p385",
    "category": "Tech Glitches",
    "text": "The Wi-Fi password requires a favorite carb. There is only one attempt before someone else takes the available connection.\n\nAs {name}: Choose the carb you are betting on."
  },
  {
    "id": "p386",
    "category": "Tech Glitches",
    "text": "A doorbell makes up summaries of visitors. A friend clipped the way it described your arrival.\n\nAs {name}: Quote the flattering or incriminating part."
  },
  {
    "id": "p387",
    "category": "Tech Glitches",
    "text": "A maps app rates the passenger instead of the route. You sat quietly and held two drinks.\n\nAs {name}: Give the app a wildly specific reason to give you five stars."
  },
  {
    "id": "p388",
    "category": "Tech Glitches",
    "text": "A password reset requests a genuinely obscure security question. It must be obscure but not personal enough to share a secret.\n\nAs {name}: Write the question you’d actually remember."
  },
  {
    "id": "p389",
    "category": "Tech Glitches",
    "text": "A playlist labels the last track Crisis Music. A friend wants you to share the playlist publicly.\n\nAs {name}: Explain the track’s place in the soundtrack of your week."
  },
  {
    "id": "p390",
    "category": "Tech Glitches",
    "text": "The robot vacuum requests a raise. It currently gets paid in charging time.\n\nAs {name}: Offer it a perk that is cheaper than a raise."
  },
  {
    "id": "p391",
    "category": "Tech Glitches",
    "text": "A smart light only changes colors if complimented. You need the bulb off before your friend falls asleep.\n\nAs {name}: Offer it the compliment that gets the job done."
  },
  {
    "id": "p392",
    "category": "Tech Glitches",
    "text": "An app lets people erase one everyday object from every photo ever taken. You can erase it from photo history without changing real life.\n\nAs {name}: Choose what’s leaving your entire camera roll."
  },
  {
    "id": "p393",
    "category": "Tech Glitches",
    "text": "Transcription turns every laugh into a real word. The transcript will be read at breakfast.\n\nAs {name}: Decide how it records your laugh in a single word."
  },
  {
    "id": "p394",
    "category": "Tech Glitches",
    "text": "A tablet unlocks through interpretive dance. The people behind you are watching.\n\nAs {name}: Name the least conspicuous move you’d try first."
  },
  {
    "id": "p395",
    "category": "Tech Glitches",
    "text": "A route can avoid awkward conversations. The app offers a 40-minute detour to skip a single conversation.\n\nAs {name}: Describe who or what it’s trying to avoid."
  },
  {
    "id": "p396",
    "category": "Tech Glitches",
    "text": "One earbud vanishes in plain sight. The case has been checked twice.\n\nAs {name}: Announce your last, completely impractical search technique."
  },
  {
    "id": "p397",
    "category": "Tech Glitches",
    "text": "Downloads are named by their emotional impact. You need to find the thing you downloaded yesterday.\n\nAs {name}: Supply the disturbingly honest filename."
  },
  {
    "id": "p398",
    "category": "Tech Glitches",
    "text": "A kettle asks why the same water keeps getting reheated. It has seen you forget your tea three times.\n\nAs {name}: Tell it why this attempt is different."
  },
  {
    "id": "p399",
    "category": "Tech Glitches",
    "text": "The receipt printer offers translation into friend language. Your friend wants to know whether they owe you anything.\n\nAs {name}: Give the translation the machine should print."
  },
  {
    "id": "p400",
    "category": "Tech Glitches",
    "text": "The phone says its storage is full of one type of image. It offers to delete all those images at once.\n\nAs {name}: Say what you hope and fear that category contains."
  },
  {
    "id": "p401",
    "category": "Low-Stakes Debates",
    "text": "Someone has to defend sitting in the middle seat. The window has a good view and the aisle has easy exits.\n\nAs {name}: Name the one advantage nobody can take away from the middle."
  },
  {
    "id": "p402",
    "category": "Low-Stakes Debates",
    "text": "A friend wants naps on the shared calendar. Someone has started sending calendar invites already.\n\nAs {name}: State one condition for attending a group nap."
  },
  {
    "id": "p403",
    "category": "Low-Stakes Debates",
    "text": "Judge a hot dog’s eligibility as a taco. The judge wants one criterion broad enough to apply to a real taco too.\n\nAs {name}: Give your verdict in one line."
  },
  {
    "id": "p404",
    "category": "Low-Stakes Debates",
    "text": "A friend likes sitting in front of the movie theater. The friend bought the front row for tonight.\n\nAs {name}: Say what would make a neck-craning seat worth keeping."
  },
  {
    "id": "p405",
    "category": "Low-Stakes Debates",
    "text": "The group has to rank the shapes of doors. The winner gets installed on a new house.\n\nAs {name}: Argue for a particular shape and its practical flaw."
  },
  {
    "id": "p406",
    "category": "Low-Stakes Debates",
    "text": "Someone insists a gift bag is always better than wrapping paper. A friend has to gift-wrap a bicycle.\n\nAs {name}: Name the one occasion the losing method actually wins."
  },
  {
    "id": "p407",
    "category": "Low-Stakes Debates",
    "text": "A photo may not count if it isn’t posted. The photo is flattering for once but nobody has service.\n\nAs {name}: Decide what qualifies as an official photo."
  },
  {
    "id": "p408",
    "category": "Low-Stakes Debates",
    "text": "Menus should list dishes by portion size. You have ten seconds to find dinner on the new menu.\n\nAs {name}: Propose a less stressful sorting method."
  },
  {
    "id": "p409",
    "category": "Low-Stakes Debates",
    "text": "There is one pillow for two prized couch corners. Both claim the spot by right of arriving first.\n\nAs {name}: Introduce a way to allocate it that doesn’t need a rematch."
  },
  {
    "id": "p410",
    "category": "Low-Stakes Debates",
    "text": "Monday gets a trial period before officially starting. Wednesday isn’t willing to absorb the extra day.\n\nAs {name}: Announce which tasks are permitted during the trial."
  },
  {
    "id": "p411",
    "category": "Low-Stakes Debates",
    "text": "Someone wants to outlaw shuffling shower playlists. A friend says their shampoo routine depends on one song.\n\nAs {name}: Carve out a sensible and specific exception."
  },
  {
    "id": "p412",
    "category": "Low-Stakes Debates",
    "text": "Everyone must unanimously approve one snack. Everyone vetoes a different flavor.\n\nAs {name}: Make the case for the snack you’d fight all the way through intermission for."
  },
  {
    "id": "p413",
    "category": "Low-Stakes Debates",
    "text": "A friend proposes halftime for movies. The movie pauses at its most dramatic moment.\n\nAs {name}: Announce one activity to reward the audience for putting up with it."
  },
  {
    "id": "p414",
    "category": "Low-Stakes Debates",
    "text": "The group argues about keeping the lights on for plants. One roommate thinks the fern is scared of darkness.\n\nAs {name}: Compromise without speaking on its behalf."
  },
  {
    "id": "p415",
    "category": "Low-Stakes Debates",
    "text": "One kind of furniture may be banned from restaurants. The restaurant is already fully furnished.\n\nAs {name}: Pick one thing diners can live without."
  },
  {
    "id": "p416",
    "category": "Low-Stakes Debates",
    "text": "The right number of reusable bags is up for debate. The closet door won’t close.\n\nAs {name}: Defend a relationship between the number of bags and the size of one’s errands."
  },
  {
    "id": "p417",
    "category": "Low-Stakes Debates",
    "text": "A friend argues that on my way is a state of mind. They are in pajamas and the car has not started.\n\nAs {name}: Propose the status message they should send instead."
  },
  {
    "id": "p418",
    "category": "Low-Stakes Debates",
    "text": "The table can rule that beach towels count as blankets. The friend has used a towel all night without complaint.\n\nAs {name}: State the test it passed or failed."
  },
  {
    "id": "p419",
    "category": "Low-Stakes Debates",
    "text": "Someone says the best errands can be done in slippers. The best slipper errand comes with a slight risk of being seen.\n\nAs {name}: Name it and make it worth the trade."
  },
  {
    "id": "p420",
    "category": "Low-Stakes Debates",
    "text": "A friend wants a secret track on every playlist. Everyone picks a song too obvious to be a secret.\n\nAs {name}: Nominate a final track no one would predict."
  },
  {
    "id": "p421",
    "category": "Low-Stakes Debates",
    "text": "The group votes for four- or five-day long weekends. The extra day can’t come off Tuesday.\n\nAs {name}: Invent a compromise that changes the weekend without cutting a workday."
  },
  {
    "id": "p422",
    "category": "Low-Stakes Debates",
    "text": "Someone is offended by a napkin under their drink. The drink is making a ring on the table.\n\nAs {name}: Defend the napkin like it did everyone a favor."
  },
  {
    "id": "p423",
    "category": "Low-Stakes Debates",
    "text": "Sports commentary is replaced with compliments. The replay is of someone missing a free throw.\n\nAs {name}: Come up with an oddly sincere compliment."
  },
  {
    "id": "p424",
    "category": "Low-Stakes Debates",
    "text": "Weather appropriate might not be a dress code. It is raining and too hot for a coat.\n\nAs {name}: Exhibit the outfit that proves your side of the debate."
  },
  {
    "id": "p425",
    "category": "Low-Stakes Debates",
    "text": "The most dramatic fruit must be crowned. The contenders include a bruised pear, a loud bag of grapes, and whatever you nominate.\n\nAs {name}: Make a surprising case."
  },
  {
    "id": "p426",
    "category": "Tiny Wins",
    "text": "Someone uses an entire tube of toothpaste.\n\nAs {name}: The wrapper is still on the counter. Give the tube the retirement honors it deserves."
  },
  {
    "id": "p427",
    "category": "Tiny Wins",
    "text": "An errand postponed for months finally gets done. Everyone is around for the acknowledgment.\n\nAs {name}: Write an inscription for the smallest trophy."
  },
  {
    "id": "p428",
    "category": "Tiny Wins",
    "text": "A stuck jar opens on the first try. Nobody caught the opening on video.\n\nAs {name}: Give the account of the victory you wish they could replay."
  },
  {
    "id": "p429",
    "category": "Tiny Wins",
    "text": "A fitted sheet is folded successfully. A roommate wants proof it wasn’t just crumpled.\n\nAs {name}: Officially name the achievement."
  },
  {
    "id": "p430",
    "category": "Tiny Wins",
    "text": "The right lid is found in one grab. Three previous lids almost fit.\n\nAs {name}: Crown the true champion without insulting the competition."
  },
  {
    "id": "p431",
    "category": "Tiny Wins",
    "text": "The kitchen timer and the perfectly cooked food agree. The people at the table weren’t expecting on-time dinner.\n\nAs {name}: Announce the cook’s achievement."
  },
  {
    "id": "p432",
    "category": "Tiny Wins",
    "text": "The reusable bag makes it into the store. The bag is slightly crumpled from years in the car.\n\nAs {name}: Let it give an acceptance speech."
  },
  {
    "id": "p433",
    "category": "Tiny Wins",
    "text": "The car is parked on the first attempt with an audience. The passenger was bracing for an eight-point turn.\n\nAs {name}: Deliver the replay commentary."
  },
  {
    "id": "p434",
    "category": "Tiny Wins",
    "text": "A recurring meeting nobody attends finally gets deleted. The group gains a free hour each week.\n\nAs {name}: Give their first reclaiming of that time a title."
  },
  {
    "id": "p435",
    "category": "Tiny Wins",
    "text": "A friend guesses the microwave time exactly right. They want to open a private cooking institute.\n\nAs {name}: Issue a certificate for their exact prediction."
  },
  {
    "id": "p436",
    "category": "Tiny Wins",
    "text": "Someone identifies the correct remote on the first try. Nobody has had to change inputs by accident.\n\nAs {name}: Name the ceremony that honors this rare skill."
  },
  {
    "id": "p437",
    "category": "Tiny Wins",
    "text": "A freshly vacuumed rug gets a gala. The red carpet is just the freshly cleaned rug.\n\nAs {name}: Describe your outfit before you step off it."
  },
  {
    "id": "p438",
    "category": "Tiny Wins",
    "text": "A completed puzzle has all its pieces. There is a triumphant moment before it goes back in the box.\n\nAs {name}: Give the press your one-line statement."
  },
  {
    "id": "p439",
    "category": "Tiny Wins",
    "text": "Everyone shows up exactly on time. No one wants to admit how uncommon it is.\n\nAs {name}: Come up with the official explanation for this miracle."
  },
  {
    "id": "p440",
    "category": "Tiny Wins",
    "text": "An outlet accommodates every plug. For once, nobody needs an adapter.\n\nAs {name}: Name the sculpture that all these wires make together."
  },
  {
    "id": "p441",
    "category": "Tiny Wins",
    "text": "A repair doesn’t require a second trip to the hardware store. The receipt only has one item.\n\nAs {name}: Name the documentary this unusual success deserves."
  },
  {
    "id": "p442",
    "category": "Tiny Wins",
    "text": "The line {name} chooses moves fastest. People behind you want tips for picking a line.\n\nAs {name}: Share your least scientific piece of wisdom."
  },
  {
    "id": "p443",
    "category": "Tiny Wins",
    "text": "A new group spreadsheet is useful. It is the first time the schedule is clear.\n\nAs {name}: Award the planner a job title they’d accept."
  },
  {
    "id": "p444",
    "category": "Tiny Wins",
    "text": "An old gift card still has a balance. It covers exactly one small treat.\n\nAs {name}: Announce your sudden fortune to the people nearby."
  },
  {
    "id": "p445",
    "category": "Tiny Wins",
    "text": "A friend takes recycling out just before it overflows. The lid closes without needing to be squashed.\n\nAs {name}: Read an award citation for the timely recycler."
  },
  {
    "id": "p446",
    "category": "Tiny Wins",
    "text": "The pizza arrives just as the movie starts. The opening credits line up with the doorbell.\n\nAs {name}: Christen the night after the scheduling miracle."
  },
  {
    "id": "p447",
    "category": "Tiny Wins",
    "text": "Someone guesses the jar’s lid size from across the kitchen. You could pretend you knew all along.\n\nAs {name}: Choose what your imaginary coach says about the feat."
  },
  {
    "id": "p448",
    "category": "Tiny Wins",
    "text": "The borrowed hoodie is returned without a reminder. The hood has an unrelated receipt in it.\n\nAs {name}: Thank the borrower without asking for its backstory."
  },
  {
    "id": "p449",
    "category": "Tiny Wins",
    "text": "A chipped plate retires after years of service. The whole set remembers its years of service.\n\nAs {name}: Write one slightly touching line from the remaining plates."
  },
  {
    "id": "p450",
    "category": "Tiny Wins",
    "text": "A package arrives a day early. The item is just more tape.\n\nAs {name}: Declare a celebration appropriate to this lack of suspense."
  },
  {
    "id": "p451",
    "category": "Alternate Worlds",
    "text": "Every sneeze retunes the radio. The radio changes during your favorite chorus.\n\nAs {name}: Invent a workaround for the next cold."
  },
  {
    "id": "p452",
    "category": "Alternate Worlds",
    "text": "Doors compliment people who shut them quietly. You are leaving late and trying not to wake anyone.\n\nAs {name}: Decide which compliment your door gives you."
  },
  {
    "id": "p453",
    "category": "Alternate Worlds",
    "text": "Shoes announce their wearer’s mood. There’s a first impression to make at breakfast.\n\nAs {name}: Give your shoes the line they’d blurt out."
  },
  {
    "id": "p454",
    "category": "Alternate Worlds",
    "text": "Dragons deliver groceries and take tips. The dragon crushed the crackers but toasted the bread perfectly.\n\nAs {name}: Name the tip you leave."
  },
  {
    "id": "p455",
    "category": "Alternate Worlds",
    "text": "Every person spends one day a year as a chair. Tomorrow is your chair shift and you get to pick the room.\n\nAs {name}: Say where you’ll be and who you hope sits down."
  },
  {
    "id": "p456",
    "category": "Alternate Worlds",
    "text": "The moon is a giant movie screen. Everyone will see the film even if they weren’t invited.\n\nAs {name}: Pick something that makes the moon’s schedule make sense."
  },
  {
    "id": "p457",
    "category": "Alternate Worlds",
    "text": "The first person awake picks the color of the day. You’re awake unusually early and have first choice.\n\nAs {name}: Pick a color and explain what today is for."
  },
  {
    "id": "p458",
    "category": "Alternate Worlds",
    "text": "Umbrellas float only on important errands. You have only one qualifying trip left this week.\n\nAs {name}: Pick an errand ridiculous enough to justify aerial transport."
  },
  {
    "id": "p459",
    "category": "Alternate Worlds",
    "text": "Elevators can add custom floors. The extra floor still has to have a name people can press.\n\nAs {name}: Specify which floor your building needs."
  },
  {
    "id": "p460",
    "category": "Alternate Worlds",
    "text": "Clouds can be borrowed for one afternoon. The cloud has to be returned with the same amount of rain.\n\nAs {name}: Give it an afternoon assignment."
  },
  {
    "id": "p461",
    "category": "Alternate Worlds",
    "text": "Everyone has a tiny marching band. The band needs an entrance cue before the party.\n\nAs {name}: Choose the exact moment it plays."
  },
  {
    "id": "p462",
    "category": "Alternate Worlds",
    "text": "Yawning is a currency. A long movie leaves you unexpectedly rich.\n\nAs {name}: Name your first purchase with all this yawning money."
  },
  {
    "id": "p463",
    "category": "Alternate Worlds",
    "text": "An appliance narrates every life. You can select what narrates you, but never what it says.\n\nAs {name}: Choose the least judgmental appliance."
  },
  {
    "id": "p464",
    "category": "Alternate Worlds",
    "text": "Furniture rotates every time someone says maybe. You cannot ban the word.\n\nAs {name}: Work out what room you dare use for your next big discussion."
  },
  {
    "id": "p465",
    "category": "Alternate Worlds",
    "text": "Sinks accept suggestions from customers. You get to submit one anonymous request.\n\nAs {name}: Say what the sink could do better without becoming a shower."
  },
  {
    "id": "p466",
    "category": "Alternate Worlds",
    "text": "Weekdays are auctioned off to the highest bidder. A friend says Tuesday is secretly the best value.\n\nAs {name}: Pick a day and give your auction bid in something besides money."
  },
  {
    "id": "p467",
    "category": "Alternate Worlds",
    "text": "Everyone names the sunset. Everyone sees the names at once.\n\nAs {name}: Give tonight’s sunset a title that fits a mundane day made weirdly beautiful."
  },
  {
    "id": "p468",
    "category": "Alternate Worlds",
    "text": "Shopping carts provide unwanted life advice. Your cart makes a personal comment in aisle two.\n\nAs {name}: Say what advice you will refuse to follow."
  },
  {
    "id": "p469",
    "category": "Alternate Worlds",
    "text": "Socks travel in herds. You’re late and need two socks of the same color.\n\nAs {name}: Lure a pair without spooking the herd."
  },
  {
    "id": "p470",
    "category": "Alternate Worlds",
    "text": "Alarm clocks write performance reviews. The review scores you in punctuality and enthusiasm.\n\nAs {name}: Say what your alarm reported this week."
  },
  {
    "id": "p471",
    "category": "Alternate Worlds",
    "text": "Umbrellas refuse to close until thanked. It’s an audience of one but you are stuck at the front of the cafe.\n\nAs {name}: Compose your briefest gratitude speech."
  },
  {
    "id": "p472",
    "category": "Alternate Worlds",
    "text": "Floor tiles remember dance moves. Your friends will see tomorrow what the tiles recorded.\n\nAs {name}: Choose one move to leave on purpose."
  },
  {
    "id": "p473",
    "category": "Alternate Worlds",
    "text": "Houses have a theme song that plays when the front door opens. You only have time for three seconds of music before opening it.\n\nAs {name}: Choose what tells visitors they’re at the right house."
  },
  {
    "id": "p474",
    "category": "Alternate Worlds",
    "text": "Every sandwich comes with a prophecy. Your sandwich is perfectly ordinary until you read the note.\n\nAs {name}: Give it a prophecy about your next hour."
  },
  {
    "id": "p475",
    "category": "Alternate Worlds",
    "text": "Everyone can add one feature to the local park. The park is already very nice but has one blank plot.\n\nAs {name}: Propose a feature nobody will believe you were allowed to build."
  },
  {
    "id": "p476",
    "category": "Goodbyes",
    "text": "The group yearbook needs a very specific fake award. Nobody can win a mean award.\n\nAs {name}: Write one so specific somebody will be proud of it."
  },
  {
    "id": "p477",
    "category": "Goodbyes",
    "text": "The guests review each other instead of the cabin. Your review has to stay kind to the host.\n\nAs {name}: Give the funniest title about this group."
  },
  {
    "id": "p478",
    "category": "Goodbyes",
    "text": "A time capsule can hold one group artifact. Future readers get no explanation beyond your item label.\n\nAs {name}: Choose an artifact and label it."
  },
  {
    "id": "p479",
    "category": "Goodbyes",
    "text": "A favor voucher needs a hilariously specific exception. It’s usable by anyone in the group.\n\nAs {name}: Write the one thing the voucher explicitly won’t cover."
  },
  {
    "id": "p480",
    "category": "Goodbyes",
    "text": "Everyone signs a ridiculous farewell pledge. It’s one line and everyone must sign.\n\nAs {name}: Make the promise silly enough to keep."
  },
  {
    "id": "p481",
    "category": "Goodbyes",
    "text": "The weekend slideshow has one caption. You get no chance to explain the photos individually.\n\nAs {name}: Write a caption doing justice to the entire weekend."
  },
  {
    "id": "p482",
    "category": "Goodbyes",
    "text": "An unexpected item gets a thank-you toast. The room has its drinks raised already.\n\nAs {name}: Thank a small object and give it a reason."
  },
  {
    "id": "p483",
    "category": "Goodbyes",
    "text": "A card reads “I miss you, but not your playlist choices”. The card has space for a warm sentence after the joke.\n\nAs {name}: Write a line you would actually want to get."
  },
  {
    "id": "p484",
    "category": "Goodbyes",
    "text": "The first hangout is reenacted in just fifteen seconds. There’s only enough time to recreate one tiny scene.\n\nAs {name}: Direct the actors to the right moment."
  },
  {
    "id": "p485",
    "category": "Goodbyes",
    "text": "The only souvenir must be an item in the room. You need to pick something you can leave with without anyone missing it.\n\nAs {name}: Give it a meaningful souvenir label."
  },
  {
    "id": "p486",
    "category": "Goodbyes",
    "text": "The guestbook has room for one last line. The owners will read it later.\n\nAs {name}: Cap the trip with a line that won’t make them ask for names."
  },
  {
    "id": "p487",
    "category": "Goodbyes",
    "text": "A future archaeologist uncovers the group’s grocery receipt. The receipt is weirdly complete.\n\nAs {name}: Pick the item that will create the most confusing historical theory."
  },
  {
    "id": "p488",
    "category": "Goodbyes",
    "text": "The reunion needs an official dress code. Everyone needs to be able to pack it in a carry-on.\n\nAs {name}: Name a deliberately unserious dress code."
  },
  {
    "id": "p489",
    "category": "Goodbyes",
    "text": "The group’s funniest memory needs a movie title. The title must still be funny to someone who wasn’t there.\n\nAs {name}: Give the memory the right name."
  },
  {
    "id": "p490",
    "category": "Goodbyes",
    "text": "The reunion needs a name in everyone’s calendar. It will appear every year unless someone deletes it.\n\nAs {name}: Give the invite a name they’ll want to keep."
  },
  {
    "id": "p491",
    "category": "Goodbyes",
    "text": "A dramatic exit goes through the wrong door. You have time for one line before opening the correct door.\n\nAs {name}: Finish as if the first exit was intentional."
  },
  {
    "id": "p492",
    "category": "Goodbyes",
    "text": "A novelty check is payable in a single favor. The check carries no spending limit, only one request.\n\nAs {name}: Name the nicest harmless favor you could cash it for."
  },
  {
    "id": "p493",
    "category": "Goodbyes",
    "text": "The new group tradition must take less than a minute. Nobody is adding another meeting to the calendar.\n\nAs {name}: Make the new tradition take under a minute."
  },
  {
    "id": "p494",
    "category": "Goodbyes",
    "text": "A time capsule video needs instructions for future viewers. Future you watches the video after forgetting all the context.\n\nAs {name}: Give them one first instruction."
  },
  {
    "id": "p495",
    "category": "Goodbyes",
    "text": "The next year of friendship gets a weather report.\n\nAs {name}: Give the group a forecast that predicts one tiny recurring event and a sunny longer-term outlook."
  },
  {
    "id": "p496",
    "category": "Goodbyes",
    "text": "The toast calls for one oddly specific thing they will miss. It shouldn’t be “everyone” or “the vibes”.\n\nAs {name}: Name a very small moment that people will recognize."
  },
  {
    "id": "p497",
    "category": "Goodbyes",
    "text": "A friend offers to send one souvenir per month. Your friend can only use a flat envelope and one stamp.\n\nAs {name}: Choose what they should send you."
  },
  {
    "id": "p498",
    "category": "Goodbyes",
    "text": "The farewell toast requires one joke about snacks. The person who brought the snacks is in the room.\n\nAs {name}: Give the food some loving grief before turning sincere."
  },
  {
    "id": "p499",
    "category": "Goodbyes",
    "text": "A formal state of the group address needs an opening line. The group is giving the annual address its imaginary standing ovation.\n\nAs {name}: Open with the most honest tiny announcement."
  },
  {
    "id": "p500",
    "category": "Goodbyes",
    "text": "The game ends with one final line on the TV. The screen will go dark just after everyone reads it.\n\nAs {name}: Choose one funny or warm last line."
  }
];
