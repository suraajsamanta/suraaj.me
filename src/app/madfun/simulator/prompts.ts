import type { Prompt } from './engine';

// One familiar setup and one plain-language question per card.
export const SIMULATOR_PROMPTS: Prompt[] = [
  {
    "id": "p001",
    "category": "Group Chat",
    "text": "Everyone says they’re five minutes away, but no one has left.\n\nWhat would {name} text back?"
  },
  {
    "id": "p002",
    "category": "Group Chat",
    "text": "A friend asks what time dinner is right under the pinned plan.\n\nWhat would {name} reply?"
  },
  {
    "id": "p003",
    "category": "Group Chat",
    "text": "A friend sends a six-minute voice note called “quick update.”\n\nWhat would {name} text after listening?"
  },
  {
    "id": "p004",
    "category": "Group Chat",
    "text": "Someone suddenly replies to a meme from three years ago.\n\nWhat would {name} say?"
  },
  {
    "id": "p005",
    "category": "Group Chat",
    "text": "The group chat has 200 unread messages after lunch.\n\nWhat would {name} text before scrolling?"
  },
  {
    "id": "p006",
    "category": "Group Chat",
    "text": "A friend accidentally adds their mom to the group chat.\n\nWhat would {name} say to her?"
  },
  {
    "id": "p007",
    "category": "Group Chat",
    "text": "Someone deletes a message and says, “Don’t ask.”\n\nWhat would {name} ask anyway?"
  },
  {
    "id": "p008",
    "category": "Group Chat",
    "text": "A friend posts their grocery list in the chat by mistake.\n\nWhich item would {name} make fun of?"
  },
  {
    "id": "p009",
    "category": "Group Chat",
    "text": "Someone types for a whole minute and then sends “ok.”\n\nWhat would {name} text back?"
  },
  {
    "id": "p010",
    "category": "Group Chat",
    "text": "A new chat was made to plan dinner, but everyone is talking about dessert.\n\nWhat would {name} say?"
  },
  {
    "id": "p011",
    "category": "Group Chat",
    "text": "The dinner poll is tied between pizza and tacos.\n\nWhich would {name} vote for?"
  },
  {
    "id": "p012",
    "category": "Group Chat",
    "text": "A friend announces a phone break and posts a selfie two minutes later.\n\nWhat would {name} comment?"
  },
  {
    "id": "p013",
    "category": "Group Chat",
    "text": "Someone sends a blurry photo with the caption “you had to be there.”\n\nWhat would {name} guess happened?"
  },
  {
    "id": "p014",
    "category": "Group Chat",
    "text": "Everyone’s standing outside, and the friend with the door code isn’t answering.\n\nWhat would {name} text them?"
  },
  {
    "id": "p015",
    "category": "Group Chat",
    "text": "A friend drops their toast and sends a photo of the mess.\n\nHow would {name} respond?"
  },
  {
    "id": "p016",
    "category": "Group Chat",
    "text": "The only detail in a party invite is “wear comfortable shoes.”\n\nWhat would {name} ask the host?"
  },
  {
    "id": "p017",
    "category": "Group Chat",
    "text": "Nobody can agree on a name for the group chat.\n\nWhat would {name} call it?"
  },
  {
    "id": "p018",
    "category": "Group Chat",
    "text": "The chat can pin one photo from the weekend.\n\nWhich moment would {name} pick?"
  },
  {
    "id": "p019",
    "category": "Group Chat",
    "text": "A friend sends a three-hour calendar invite called “Maybe Brunch.”\n\nHow would {name} RSVP?"
  },
  {
    "id": "p020",
    "category": "Group Chat",
    "text": "Two people send the exact same joke at the same time.\n\nWho would {name} give credit to?"
  },
  {
    "id": "p021",
    "category": "Group Chat",
    "text": "An “urgent” link in the chat opens to a picture of a duck.\n\nWhat would {name} text back?"
  },
  {
    "id": "p022",
    "category": "Group Chat",
    "text": "A friend sends yesterday’s argument back to the group as screenshots.\n\nWhat would {name} reply?"
  },
  {
    "id": "p023",
    "category": "Group Chat",
    "text": "A friend asks if it’s too late to order one more pizza.\n\nWhat would {name} tell them?"
  },
  {
    "id": "p024",
    "category": "Group Chat",
    "text": "Everyone has to pick one emoji to describe the weekend.\n\nWhich emoji would {name} choose?"
  },
  {
    "id": "p025",
    "category": "Group Chat",
    "text": "The host needs a headcount, but everyone replies “I’m probably down.”\n\nWhat would {name} text to get a real answer?"
  },
  {
    "id": "p026",
    "category": "Cabin Chaos",
    "text": "Someone eats the leftovers {name} was saving.\n\nWhat would {name} say to them?"
  },
  {
    "id": "p027",
    "category": "Cabin Chaos",
    "text": "A friend schedules a sunrise hike on a supposedly lazy cabin weekend.\n\nWhat would {name} do instead?"
  },
  {
    "id": "p028",
    "category": "Cabin Chaos",
    "text": "Everyone pours cereal and realizes the cabin has one spoon.\n\nWhat would {name} use?"
  },
  {
    "id": "p029",
    "category": "Cabin Chaos",
    "text": "The hot tub is barely warm.\n\nWhat would {name} say after stepping in?"
  },
  {
    "id": "p030",
    "category": "Cabin Chaos",
    "text": "There’s a strange noise outside the cabin at midnight.\n\nWhat would {name} do first?"
  },
  {
    "id": "p031",
    "category": "Cabin Chaos",
    "text": "Rain cancels the group’s afternoon plans.\n\nWhat indoor activity would {name} suggest?"
  },
  {
    "id": "p032",
    "category": "Cabin Chaos",
    "text": "The group makes soup and finds no bowls in the cabin.\n\nWhat would {name} serve it in?"
  },
  {
    "id": "p033",
    "category": "Cabin Chaos",
    "text": "Everyone brings marshmallows but nobody brings chocolate or crackers.\n\nWhat would {name} make for dessert?"
  },
  {
    "id": "p034",
    "category": "Cabin Chaos",
    "text": "It’s checkout day and the group wants to leave a guestbook note.\n\nWhat would {name} write?"
  },
  {
    "id": "p035",
    "category": "Cabin Chaos",
    "text": "There’s a singing fish on the cabin wall.\n\nWhat song would {name} want it to sing?"
  },
  {
    "id": "p036",
    "category": "Cabin Chaos",
    "text": "Everyone worked on a puzzle, but the last piece is missing.\n\nWhere would {name} look first?"
  },
  {
    "id": "p037",
    "category": "Cabin Chaos",
    "text": "There’s a lonely sock on the mantel and nobody claims it.\n\nWho would {name} guess left it?"
  },
  {
    "id": "p038",
    "category": "Cabin Chaos",
    "text": "The friend on fire duty admits they’ve never made a campfire.\n\nWhat would {name} say to them?"
  },
  {
    "id": "p039",
    "category": "Cabin Chaos",
    "text": "One bedroom has bunk beds and the other has a big soft bed.\n\nWhich bed would {name} claim?"
  },
  {
    "id": "p040",
    "category": "Cabin Chaos",
    "text": "The loudest snorer asks to share a room.\n\nWhat would {name} say?"
  },
  {
    "id": "p041",
    "category": "Cabin Chaos",
    "text": "The cabin fridge has six kinds of mustard and nothing for dinner.\n\nWhat would {name} order?"
  },
  {
    "id": "p042",
    "category": "Cabin Chaos",
    "text": "The listing promised lake views, but you can only see the parking lot.\n\nWhat would {name} write in the review?"
  },
  {
    "id": "p043",
    "category": "Cabin Chaos",
    "text": "Everyone has to get ready using one tiny mirror.\n\nHow would {name} decide who goes first?"
  },
  {
    "id": "p044",
    "category": "Cabin Chaos",
    "text": "The only available boat is a wobbly canoe.\n\nWho would {name} want as their canoe partner?"
  },
  {
    "id": "p045",
    "category": "Cabin Chaos",
    "text": "The group is playing cards and one person reads the rules out loud.\n\nWhat would {name} say when it reaches minute five?"
  },
  {
    "id": "p046",
    "category": "Cabin Chaos",
    "text": "Campfire smoke keeps following {name} from seat to seat.\n\nWhat would {name} say about it?"
  },
  {
    "id": "p047",
    "category": "Cabin Chaos",
    "text": "A friend falls asleep in the best chair before game night.\n\nHow would {name} get the chair back?"
  },
  {
    "id": "p048",
    "category": "Cabin Chaos",
    "text": "Everyone wants the cabin warmer or colder at the same time.\n\nWhat temperature would {name} set?"
  },
  {
    "id": "p049",
    "category": "Cabin Chaos",
    "text": "Nobody knows how to turn off the cabin’s porch light.\n\nWhat would {name} try first?"
  },
  {
    "id": "p050",
    "category": "Cabin Chaos",
    "text": "Four friends bring identical blankets and mix them up.\n\nHow would {name} figure out which one is theirs?"
  },
  {
    "id": "p051",
    "category": "Food Court",
    "text": "One slice of pizza is left and everyone says they don’t want it.\n\nWould {name} take it, and what would they say?"
  },
  {
    "id": "p052",
    "category": "Food Court",
    "text": "The server asks if everyone wants to split a bill evenly after {name} only ordered fries.\n\nWhat would {name} say?"
  },
  {
    "id": "p053",
    "category": "Food Court",
    "text": "A café calls two slices of toast a fourteen-dollar sandwich.\n\nWhat would {name} tell their friend?"
  },
  {
    "id": "p054",
    "category": "Food Court",
    "text": "A friend insists cereal is soup.\n\nWhat would {name} argue?"
  },
  {
    "id": "p055",
    "category": "Food Court",
    "text": "The menu has a “chef’s surprise” with no description.\n\nWould {name} order it?"
  },
  {
    "id": "p056",
    "category": "Food Court",
    "text": "A friend cuts pizza with kitchen scissors.\n\nWhat would {name} say?"
  },
  {
    "id": "p057",
    "category": "Food Court",
    "text": "A vending machine drops two snacks instead of one.\n\nWho would {name} give the extra to?"
  },
  {
    "id": "p058",
    "category": "Food Court",
    "text": "A friend says they don’t want fries, then reaches for {name}’s plate.\n\nWhat would {name} say?"
  },
  {
    "id": "p059",
    "category": "Food Court",
    "text": "The takeout bag has five forks but the entire order is wings.\n\nWhat would {name} do with the forks?"
  },
  {
    "id": "p060",
    "category": "Food Court",
    "text": "Someone shows up with a board covered in gas-station snacks.\n\nWhich snack would {name} grab first?"
  },
  {
    "id": "p061",
    "category": "Food Court",
    "text": "The restaurant sends a free side dish nobody recognizes.\n\nWould {name} try it first?"
  },
  {
    "id": "p062",
    "category": "Food Court",
    "text": "Someone asks {name} to taste a sauce they just made.\n\nWhat would {name} say if it’s way too salty?"
  },
  {
    "id": "p063",
    "category": "Food Court",
    "text": "The last cookie is broken in half.\n\nWhich half would {name} take?"
  },
  {
    "id": "p064",
    "category": "Food Court",
    "text": "A friend puts sprinkles on pancakes like it’s completely normal.\n\nWhat topping would {name} add?"
  },
  {
    "id": "p065",
    "category": "Food Court",
    "text": "A friend brings an empty bowl to the potluck and calls it “good vibes.”\n\nWhat would {name} tell them to bring next time?"
  },
  {
    "id": "p066",
    "category": "Food Court",
    "text": "The group needs one snack for a long car ride.\n\nWhat would {name} pick?"
  },
  {
    "id": "p067",
    "category": "Food Court",
    "text": "Everyone orders dessert except a friend who orders a pickle.\n\nWhat would {name} say when it arrives?"
  },
  {
    "id": "p068",
    "category": "Food Court",
    "text": "A friend says the group should eat healthy and then buys three bags of chips.\n\nWhat would {name} say?"
  },
  {
    "id": "p069",
    "category": "Food Court",
    "text": "The barista writes the wrong name on {name}’s cup.\n\nWould {name} correct it or go with it?"
  },
  {
    "id": "p070",
    "category": "Food Court",
    "text": "A friend offers a bite of dinner but refuses to say what’s in it.\n\nWhat would {name} ask first?"
  },
  {
    "id": "p071",
    "category": "Food Court",
    "text": "A friend microwaves leftover fish right before movie night.\n\nWhat would {name} say?"
  },
  {
    "id": "p072",
    "category": "Food Court",
    "text": "The sandwich shop lets customers invent a special.\n\nWhat would {name} put on theirs?"
  },
  {
    "id": "p073",
    "category": "Food Court",
    "text": "A friend puts ketchup on a food {name} thinks doesn’t need it.\n\nWhat food would make {name} speak up?"
  },
  {
    "id": "p074",
    "category": "Food Court",
    "text": "A friend pours tap water and describes it like a fancy wine.\n\nWhat would {name} say after tasting it?"
  },
  {
    "id": "p075",
    "category": "Food Court",
    "text": "The ice cream truck has one flavor left, and it’s bright blue.\n\nWhat would {name} guess it tastes like?"
  },
  {
    "id": "p076",
    "category": "Everyday Disasters",
    "text": "Someone holds a door for {name} from way too far away.\n\nWould {name} speed up or keep walking?"
  },
  {
    "id": "p077",
    "category": "Everyday Disasters",
    "text": "The self-checkout calls for help over a single banana.\n\nWhat would {name} say to the machine?"
  },
  {
    "id": "p078",
    "category": "Everyday Disasters",
    "text": "The elevator stops at every floor and nobody gets on.\n\nWhat would {name} do?"
  },
  {
    "id": "p079",
    "category": "Everyday Disasters",
    "text": "People start lining up behind {name}, who isn’t actually in line.\n\nWhat would {name} tell them?"
  },
  {
    "id": "p080",
    "category": "Everyday Disasters",
    "text": "A sock disappears in the dryer again.\n\nWhere would {name} say it went?"
  },
  {
    "id": "p081",
    "category": "Everyday Disasters",
    "text": "{name} waves back at someone who was waving at the person behind them.\n\nHow would {name} play it off?"
  },
  {
    "id": "p082",
    "category": "Everyday Disasters",
    "text": "The printer jams just as {name} needs one page.\n\nWhat would {name} say to it?"
  },
  {
    "id": "p083",
    "category": "Everyday Disasters",
    "text": "Only one checkout lane is open and everyone has a full cart.\n\nWould {name} wait or leave?"
  },
  {
    "id": "p084",
    "category": "Everyday Disasters",
    "text": "A clearly marked pull door defeats {name} twice.\n\nWhat would {name} say if their friend saw?"
  },
  {
    "id": "p085",
    "category": "Everyday Disasters",
    "text": "An escalator is broken and someone’s standing on it, waiting.\n\nWhat would {name} say to them?"
  },
  {
    "id": "p086",
    "category": "Everyday Disasters",
    "text": "There’s one tiny piece of tape left and a whole present to wrap.\n\nWhat would {name} do?"
  },
  {
    "id": "p087",
    "category": "Everyday Disasters",
    "text": "The hairdresser spins the chair around and the haircut is way shorter than requested.\n\nWhat would {name} say?"
  },
  {
    "id": "p088",
    "category": "Everyday Disasters",
    "text": "A friend asks if an outfit works and it definitely doesn’t.\n\nHow would {name} answer?"
  },
  {
    "id": "p089",
    "category": "Everyday Disasters",
    "text": "The rain starts and the only umbrella is tiny.\n\nWho would {name} share it with?"
  },
  {
    "id": "p090",
    "category": "Everyday Disasters",
    "text": "{name} walks into the wrong room and everyone turns to look.\n\nWhat would {name} say?"
  },
  {
    "id": "p091",
    "category": "Everyday Disasters",
    "text": "A store sells a candle that smells exactly like a freshly cleaned bathroom.\n\nWould {name} buy it?"
  },
  {
    "id": "p092",
    "category": "Everyday Disasters",
    "text": "A receipt reveals someone spent $18 on one smoothie.\n\nWhat would {name} say about it?"
  },
  {
    "id": "p093",
    "category": "Everyday Disasters",
    "text": "The barista calls a name and three people stand up.\n\nWhat would {name} do if it might be their drink?"
  },
  {
    "id": "p094",
    "category": "Everyday Disasters",
    "text": "The movie theater lights turn on during the best scene.\n\nWhat would {name} say?"
  },
  {
    "id": "p095",
    "category": "Everyday Disasters",
    "text": "The shopping cart keeps pulling to the left.\n\nWould {name} swap it or keep going?"
  },
  {
    "id": "p096",
    "category": "Everyday Disasters",
    "text": "It takes four people to open a snack bag labeled “easy open.”\n\nWhat would {name} announce when it opens?"
  },
  {
    "id": "p097",
    "category": "Everyday Disasters",
    "text": "The automatic sink works for everyone except {name}.\n\nWhat would {name} try next?"
  },
  {
    "id": "p098",
    "category": "Everyday Disasters",
    "text": "Someone leaves a note telling people to clean the microwave.\n\nWhat would {name} guess happened inside?"
  },
  {
    "id": "p099",
    "category": "Everyday Disasters",
    "text": "{name} hears their phone ring but can’t find it anywhere.\n\nWhere would {name} check first?"
  },
  {
    "id": "p100",
    "category": "Everyday Disasters",
    "text": "A street performer plays the same song every time the group walks by.\n\nWhat song would {name} request instead?"
  },
  {
    "id": "p101",
    "category": "Travel Fails",
    "text": "Your flight is delayed and the airport has one food stand.\n\nWhat would {name} order while waiting?"
  },
  {
    "id": "p102",
    "category": "Travel Fails",
    "text": "You get to the hotel two hours before check-in.\n\nWhat would {name} do until the room is ready?"
  },
  {
    "id": "p103",
    "category": "Travel Fails",
    "text": "There’s one window seat left on the train.\n\nWhat would {name} say to claim it?"
  },
  {
    "id": "p104",
    "category": "Travel Fails",
    "text": "Your suitcase comes out last at baggage claim.\n\nWhat would {name} say while you wait?"
  },
  {
    "id": "p105",
    "category": "Travel Fails",
    "text": "The hotel room has a nice view of a brick wall.\n\nWhat would {name} tell the front desk?"
  },
  {
    "id": "p106",
    "category": "Travel Fails",
    "text": "Your phone is at 2% and you still need directions.\n\nWhat would {name} do to find the hotel?"
  },
  {
    "id": "p107",
    "category": "Travel Fails",
    "text": "Everyone packed a jacket except you, and it’s cold.\n\nWhat would {name} do to stay warm?"
  },
  {
    "id": "p108",
    "category": "Travel Fails",
    "text": "The rental car is much smaller than you expected.\n\nWhat would {name} say when everyone sees it?"
  },
  {
    "id": "p109",
    "category": "Travel Fails",
    "text": "You drove an hour to a beach that’s closed.\n\nWhat would {name} suggest doing instead?"
  },
  {
    "id": "p110",
    "category": "Travel Fails",
    "text": "Your friend insists the scenic route is faster.\n\nWhat would {name} say after the third wrong turn?"
  },
  {
    "id": "p111",
    "category": "Travel Fails",
    "text": "The only breakfast near your hotel is a gas station.\n\nWhat would {name} buy for breakfast?"
  },
  {
    "id": "p112",
    "category": "Travel Fails",
    "text": "You accidentally sit in someone else’s seat on the plane.\n\nWhat would {name} say when they arrive?"
  },
  {
    "id": "p113",
    "category": "Travel Fails",
    "text": "You have ten minutes to buy a souvenir.\n\nWhat would {name} grab on the way out?"
  },
  {
    "id": "p114",
    "category": "Travel Fails",
    "text": "Rain starts right as you get to the outdoor market.\n\nWhat would {name} do next?"
  },
  {
    "id": "p115",
    "category": "Travel Fails",
    "text": "Your GPS says to walk up a very steep hill.\n\nWhat would {name} say before starting the climb?"
  },
  {
    "id": "p116",
    "category": "Travel Fails",
    "text": "You arrive at the wrong hotel with all your bags.\n\nWhat would {name} say when you realize?"
  },
  {
    "id": "p117",
    "category": "Travel Fails",
    "text": "Your friend falls asleep before you can take a road trip photo.\n\nWhat would {name} do about the photo?"
  },
  {
    "id": "p118",
    "category": "Travel Fails",
    "text": "The hotel shower takes five minutes to get warm.\n\nWhat would {name} say after testing it?"
  },
  {
    "id": "p119",
    "category": "Travel Fails",
    "text": "The plane lands and everyone stands up immediately.\n\nWhat would {name} do while waiting to get off?"
  },
  {
    "id": "p120",
    "category": "Travel Fails",
    "text": "A friend forgot their toothbrush and asks to borrow yours.\n\nWhat would {name} say back?"
  },
  {
    "id": "p121",
    "category": "Travel Fails",
    "text": "The only snack in the motel vending machine is one you hate.\n\nWhat would {name} do for a snack instead?"
  },
  {
    "id": "p122",
    "category": "Travel Fails",
    "text": "Your friend wants to stop for coffee again.\n\nWhat would {name} say on the fourth coffee stop?"
  },
  {
    "id": "p123",
    "category": "Travel Fails",
    "text": "Your bags are ready, but nobody remembers where you parked.\n\nWhat would {name} do first?"
  },
  {
    "id": "p124",
    "category": "Travel Fails",
    "text": "You have three beach towels and four people.\n\nWhat would {name} suggest to the group?"
  },
  {
    "id": "p125",
    "category": "Travel Fails",
    "text": "There are five minutes before the train leaves and the coffee line is long.\n\nWhat would {name} choose to do?"
  },
  {
    "id": "p126",
    "category": "Awkward Moments",
    "text": "You wave at someone who was waving to the person behind you.\n\nWhat would {name} do next?"
  },
  {
    "id": "p127",
    "category": "Awkward Moments",
    "text": "A server says “enjoy your meal” and you answer “you too” by accident.\n\nWhat would {name} say next?"
  },
  {
    "id": "p128",
    "category": "Awkward Moments",
    "text": "You don’t remember someone’s name and they remember yours.\n\nWhat would {name} say to get their name?"
  },
  {
    "id": "p129",
    "category": "Awkward Moments",
    "text": "You accidentally like a photo from five years ago.\n\nWhat would {name} do next?"
  },
  {
    "id": "p130",
    "category": "Awkward Moments",
    "text": "A quiet room hears your stomach growl.\n\nWhat would {name} say to break the silence?"
  },
  {
    "id": "p131",
    "category": "Awkward Moments",
    "text": "You tell a friend a story and they remind you they were there.\n\nWhat would {name} say to recover?"
  },
  {
    "id": "p132",
    "category": "Awkward Moments",
    "text": "Your friend shows up in the exact same outfit as you.\n\nWhat would {name} say when they walk in?"
  },
  {
    "id": "p133",
    "category": "Awkward Moments",
    "text": "You call your teacher “Mom” by mistake.\n\nWhat would {name} say right after?"
  },
  {
    "id": "p134",
    "category": "Awkward Moments",
    "text": "You push a door marked “pull” three times.\n\nWhat would {name} say when someone opens it for you?"
  },
  {
    "id": "p135",
    "category": "Awkward Moments",
    "text": "The person beside you catches you singing the wrong lyrics.\n\nWhat would {name} say to them?"
  },
  {
    "id": "p136",
    "category": "Awkward Moments",
    "text": "You walk out of the bathroom with toilet paper on your shoe.\n\nWhat would {name} say when a friend points it out?"
  },
  {
    "id": "p137",
    "category": "Awkward Moments",
    "text": "Someone asks how you liked a gift you’ve never used.\n\nWhat would {name} say without making it weird?"
  },
  {
    "id": "p138",
    "category": "Awkward Moments",
    "text": "You see a coworker at the gym and neither of you has said hi.\n\nWhat would {name} do first?"
  },
  {
    "id": "p139",
    "category": "Awkward Moments",
    "text": "You start telling a joke and forget the ending.\n\nWhat would {name} say instead of the punch line?"
  },
  {
    "id": "p140",
    "category": "Awkward Moments",
    "text": "You trip without falling and notice someone saw it.\n\nWhat would {name} do to play it off?"
  },
  {
    "id": "p141",
    "category": "Awkward Moments",
    "text": "You’ve just wished someone a happy birthday on the wrong day.\n\nWhat would {name} text next?"
  },
  {
    "id": "p142",
    "category": "Awkward Moments",
    "text": "You walk up to a stranger thinking they’re your friend.\n\nWhat would {name} say when they turn around?"
  },
  {
    "id": "p143",
    "category": "Awkward Moments",
    "text": "Your phone starts playing music loudly in a quiet store.\n\nWhat would {name} do first?"
  },
  {
    "id": "p144",
    "category": "Awkward Moments",
    "text": "A friend catches you looking at their fries.\n\nWhat would {name} say if you want one?"
  },
  {
    "id": "p145",
    "category": "Awkward Moments",
    "text": "You say goodbye, then both walk in the same direction.\n\nWhat would {name} talk about on the walk?"
  },
  {
    "id": "p146",
    "category": "Awkward Moments",
    "text": "You try to whisper and everyone hears you.\n\nWhat would {name} say to the group?"
  },
  {
    "id": "p147",
    "category": "Awkward Moments",
    "text": "Someone asks if you remember them and you don’t.\n\nWhat would {name} say back?"
  },
  {
    "id": "p148",
    "category": "Awkward Moments",
    "text": "You accidentally call your friend by your dog’s name.\n\nWhat would {name} say when they notice?"
  },
  {
    "id": "p149",
    "category": "Awkward Moments",
    "text": "The whole table sees you spill water on yourself.\n\nWhat would {name} say before grabbing a napkin?"
  },
  {
    "id": "p150",
    "category": "Awkward Moments",
    "text": "Everyone sings “Happy Birthday” while you sit in front of the cake.\n\nWhat would {name} do with your hands?"
  },
  {
    "id": "p151",
    "category": "Game Night",
    "text": "Everyone says they don’t care which game you play.\n\nWhat would {name} pick for the group?"
  },
  {
    "id": "p152",
    "category": "Game Night",
    "text": "Nobody read the rules and the game has already started.\n\nWhat would {name} say when the first argument begins?"
  },
  {
    "id": "p153",
    "category": "Game Night",
    "text": "You’re losing badly and someone asks how it’s going.\n\nWhat would {name} say back?"
  },
  {
    "id": "p154",
    "category": "Game Night",
    "text": "Two people want to be on the same team as you.\n\nWhat would {name} do to pick a teammate?"
  },
  {
    "id": "p155",
    "category": "Game Night",
    "text": "Your friend says they’re bad at trivia and gets every question right.\n\nWhat would {name} say to them?"
  },
  {
    "id": "p156",
    "category": "Game Night",
    "text": "A board game is missing one piece.\n\nWhat would {name} use to replace it?"
  },
  {
    "id": "p157",
    "category": "Game Night",
    "text": "Your team gets the easiest question of the night wrong.\n\nWhat would {name} say to your teammates?"
  },
  {
    "id": "p158",
    "category": "Game Night",
    "text": "The score is tied with one round left.\n\nWhat would {name} say to your team?"
  },
  {
    "id": "p159",
    "category": "Game Night",
    "text": "A friend insists they didn’t look at your cards.\n\nWhat would {name} say if you saw them peek?"
  },
  {
    "id": "p160",
    "category": "Game Night",
    "text": "Someone invents a rule halfway through the game.\n\nWhat would {name} say about the new rule?"
  },
  {
    "id": "p161",
    "category": "Game Night",
    "text": "There’s one slice of pizza left between two teams.\n\nWhat would {name} suggest as a tiebreaker?"
  },
  {
    "id": "p162",
    "category": "Game Night",
    "text": "A friend keeps asking how many points they have.\n\nWhat would {name} say the third time they ask?"
  },
  {
    "id": "p163",
    "category": "Game Night",
    "text": "Your team wins a game you don’t understand.\n\nWhat would {name} say in your victory speech?"
  },
  {
    "id": "p164",
    "category": "Game Night",
    "text": "You need a team name in ten seconds.\n\nWhat would {name} name the team?"
  },
  {
    "id": "p165",
    "category": "Game Night",
    "text": "Your turn is taking longer than everybody else’s.\n\nWhat would {name} say when they start rushing you?"
  },
  {
    "id": "p166",
    "category": "Game Night",
    "text": "Someone brings a game nobody has played before.\n\nWhat would {name} ask before agreeing to play?"
  },
  {
    "id": "p167",
    "category": "Game Night",
    "text": "Your teammate guesses the wrong word during charades.\n\nWhat would {name} act out next to help them?"
  },
  {
    "id": "p168",
    "category": "Game Night",
    "text": "You get eliminated in the first round.\n\nWhat would {name} do while everyone else plays?"
  },
  {
    "id": "p169",
    "category": "Game Night",
    "text": "Everyone wants a rematch except the winner.\n\nWhat would {name} say to convince the winner?"
  },
  {
    "id": "p170",
    "category": "Game Night",
    "text": "Your opponent offers to show you how to play after beating you.\n\nWhat would {name} say to them?"
  },
  {
    "id": "p171",
    "category": "Game Night",
    "text": "Someone knocks over the board halfway through the game.\n\nWhat would {name} suggest doing about the score?"
  },
  {
    "id": "p172",
    "category": "Game Night",
    "text": "A tie means both players have to do rock-paper-scissors.\n\nWhat would {name} throw on their first try?"
  },
  {
    "id": "p173",
    "category": "Game Night",
    "text": "Two different games have the same number of votes.\n\nWhat would {name} do to break the tie?"
  },
  {
    "id": "p174",
    "category": "Game Night",
    "text": "The host forgets whose turn it is.\n\nWhat would {name} say if the host asked them?"
  },
  {
    "id": "p175",
    "category": "Game Night",
    "text": "It’s late and your friends want to play one more game.\n\nWhat would {name} say when someone picks a long game?"
  },
  {
    "id": "p176",
    "category": "Main Character",
    "text": "A friend asks you to pick your entrance song.\n\nWhat would {name} choose?"
  },
  {
    "id": "p177",
    "category": "Main Character",
    "text": "You walk into a party and everyone is dressed nicer than you.\n\nWhat would {name} say to explain your outfit?"
  },
  {
    "id": "p178",
    "category": "Main Character",
    "text": "Your friends want you to make a toast with no warning.\n\nWhat would {name} say first?"
  },
  {
    "id": "p179",
    "category": "Main Character",
    "text": "You get the first karaoke slot and need a song now.\n\nWhat would {name} sing?"
  },
  {
    "id": "p180",
    "category": "Main Character",
    "text": "Your friend asks you to pick the group photo pose.\n\nWhat would {name} tell everyone to do?"
  },
  {
    "id": "p181",
    "category": "Main Character",
    "text": "A stranger compliments your outfit.\n\nWhat would {name} say back?"
  },
  {
    "id": "p182",
    "category": "Main Character",
    "text": "A friend says you get to plan their birthday from start to finish.\n\nWhat would {name} plan first?"
  },
  {
    "id": "p183",
    "category": "Main Character",
    "text": "Everybody sees you catch a falling cup before it hits the floor.\n\nWhat would {name} say after the catch?"
  },
  {
    "id": "p184",
    "category": "Main Character",
    "text": "You’re first to arrive at a party and nobody else is there yet.\n\nWhat would {name} do while waiting?"
  },
  {
    "id": "p185",
    "category": "Main Character",
    "text": "Your friends put you in charge of choosing music for the road trip.\n\nWhat would {name} play first?"
  },
  {
    "id": "p186",
    "category": "Main Character",
    "text": "You have thirty seconds to pick one outfit for a big night.\n\nWhat would {name} wear?"
  },
  {
    "id": "p187",
    "category": "Main Character",
    "text": "A friend gives you a microphone at a backyard party.\n\nWhat would {name} say into it?"
  },
  {
    "id": "p188",
    "category": "Main Character",
    "text": "Your friends make you take the first bite of a new dessert.\n\nWhat would {name} say after trying it?"
  },
  {
    "id": "p189",
    "category": "Main Character",
    "text": "The group asks you to name their shared photo album.\n\nWhat would {name} call it?"
  },
  {
    "id": "p190",
    "category": "Main Character",
    "text": "Your friend asks you to describe your weekend in one sentence.\n\nWhat would {name} say?"
  },
  {
    "id": "p191",
    "category": "Main Character",
    "text": "A friend says your life needs a reality show title.\n\nWhat would {name} name the show?"
  },
  {
    "id": "p192",
    "category": "Main Character",
    "text": "You walk into the kitchen and see friends making dinner for you.\n\nWhat would {name} say to thank them?"
  },
  {
    "id": "p193",
    "category": "Main Character",
    "text": "The host asks you to make a wish out loud before blowing out the candles.\n\nWhat would {name} wish for?"
  },
  {
    "id": "p194",
    "category": "Main Character",
    "text": "The group can’t decide where to go after dinner.\n\nWhat would {name} suggest?"
  },
  {
    "id": "p195",
    "category": "Main Character",
    "text": "You’re asked to give a one-line review of the party.\n\nWhat would {name} say?"
  },
  {
    "id": "p196",
    "category": "Main Character",
    "text": "Your friends ask you to pick one item that sums up your personality.\n\nWhat would {name} pick?"
  },
  {
    "id": "p197",
    "category": "Main Character",
    "text": "Someone says it’s your turn to tell the group a funny story.\n\nWhat would {name} tell them about?"
  },
  {
    "id": "p198",
    "category": "Main Character",
    "text": "A friend lets you choose a nickname for yourself.\n\nWhat would {name} pick?"
  },
  {
    "id": "p199",
    "category": "Main Character",
    "text": "The group asks you to choose one thing to put in a time capsule.\n\nWhat would {name} put in it?"
  },
  {
    "id": "p200",
    "category": "Main Character",
    "text": "Everyone is about to leave and someone asks for one last group photo.\n\nWhat would {name} say to get them to smile?"
  },
  {
    "id": "p201",
    "category": "Internet Nonsense",
    "text": "Someone posts a photo of their dinner before anyone can take a bite.\n\nWhat would {name} comment?"
  },
  {
    "id": "p202",
    "category": "Internet Nonsense",
    "text": "A friend sends the same meme for the third time this week.\n\nWhat would {name} send back?"
  },
  {
    "id": "p203",
    "category": "Internet Nonsense",
    "text": "A recipe video spends five minutes showing the kitchen before it starts cooking.\n\nWhat would {name} say?"
  },
  {
    "id": "p204",
    "category": "Internet Nonsense",
    "text": "An influencer shows how to fold a shirt in two seconds.\n\nWhat would {name} do after watching it?"
  },
  {
    "id": "p205",
    "category": "Internet Nonsense",
    "text": "A friend asks the internet to pick between two almost identical outfits.\n\nWhich photo would {name} vote for?"
  },
  {
    "id": "p206",
    "category": "Internet Nonsense",
    "text": "A stranger gives a beach five stars because they saw a dog there.\n\nWhat would {name} write in their own review?"
  },
  {
    "id": "p207",
    "category": "Internet Nonsense",
    "text": "A photo of the group goes up, and everyone looks good except one person.\n\nWhat would {name} do about the photo?"
  },
  {
    "id": "p208",
    "category": "Internet Nonsense",
    "text": "Someone shares a concert video where you can only hear them singing.\n\nWhat would {name} text them?"
  },
  {
    "id": "p209",
    "category": "Internet Nonsense",
    "text": "A friend asks everyone to like their pet's first post.\n\nWhat would {name} write under the photo?"
  },
  {
    "id": "p210",
    "category": "Internet Nonsense",
    "text": "A celebrity posts a blurry picture of a sandwich with no caption.\n\nWhat would {name} guess the sandwich is?"
  },
  {
    "id": "p211",
    "category": "Internet Nonsense",
    "text": "A funny video ends just before the part everyone wants to see.\n\nWhat would {name} comment?"
  },
  {
    "id": "p212",
    "category": "Internet Nonsense",
    "text": "A friend posts an old group picture from an awkward fashion phase.\n\nWhat would {name} say about the outfits?"
  },
  {
    "id": "p213",
    "category": "Internet Nonsense",
    "text": "A website asks you to accept cookies, but there's no food in sight.\n\nWhat kind of cookie would {name} actually want?"
  },
  {
    "id": "p214",
    "category": "Internet Nonsense",
    "text": "A friend sends a cat video to cheer everyone up.\n\nWhat animal video would {name} send next?"
  },
  {
    "id": "p215",
    "category": "Internet Nonsense",
    "text": "An online quiz claims your favorite pizza reveals your personality.\n\nWhat pizza topping would {name} pick?"
  },
  {
    "id": "p216",
    "category": "Internet Nonsense",
    "text": "A friend uses a baby picture as their profile photo.\n\nWhat picture would {name} use as a joke?"
  },
  {
    "id": "p217",
    "category": "Internet Nonsense",
    "text": "A short video starts with “wait for it” but nothing happens.\n\nWhat would {name} say to the person who sent it?"
  },
  {
    "id": "p218",
    "category": "Internet Nonsense",
    "text": "A group selfie gets posted with everyone's eyes closed at once.\n\nWhat caption would {name} give it?"
  },
  {
    "id": "p219",
    "category": "Internet Nonsense",
    "text": "A store asks for a review of socks you bought yesterday.\n\nWhat would {name} write about them?"
  },
  {
    "id": "p220",
    "category": "Internet Nonsense",
    "text": "A friend posts a vacation photo from the wrong city.\n\nWhat would {name} reply?"
  },
  {
    "id": "p221",
    "category": "Internet Nonsense",
    "text": "Everyone is doing a dance online that looks easy until you try it.\n\nWould {name} try it or keep scrolling?"
  },
  {
    "id": "p222",
    "category": "Internet Nonsense",
    "text": "A weather app says it's sunny while rain hits the window.\n\nWhat would {name} send to prove it wrong?"
  },
  {
    "id": "p223",
    "category": "Internet Nonsense",
    "text": "Someone asks for honest feedback on their new haircut online.\n\nWhat would {name} tell them?"
  },
  {
    "id": "p224",
    "category": "Internet Nonsense",
    "text": "A video shows a dog refusing to leave the couch.\n\nWhat would {name} name that dog?"
  },
  {
    "id": "p225",
    "category": "Internet Nonsense",
    "text": "A friend wants to post their first cooking video.\n\nWhat dish would {name} tell them to make?"
  },
  {
    "id": "p226",
    "category": "Wrong Answers Only",
    "text": "The ice cream shop runs out of cones.\n\nWhat would {name} use instead of a cone if they had to be silly?"
  },
  {
    "id": "p227",
    "category": "Wrong Answers Only",
    "text": "A dog walks into class and sits at an empty desk.\n\nWhat subject would {name} pretend the dog teaches?"
  },
  {
    "id": "p228",
    "category": "Wrong Answers Only",
    "text": "Someone hands you a remote with only one button.\n\nWhat funny thing would {name} say the button does?"
  },
  {
    "id": "p229",
    "category": "Wrong Answers Only",
    "text": "Your toast pops up burnt again.\n\nWhat fancy name would {name} give it?"
  },
  {
    "id": "p230",
    "category": "Wrong Answers Only",
    "text": "You find a single clean sock in the laundry.\n\nWhere would {name} say the other sock went?"
  },
  {
    "id": "p231",
    "category": "Wrong Answers Only",
    "text": "A friend wants to name their new vacuum.\n\nWhat would {name} call it?"
  },
  {
    "id": "p232",
    "category": "Wrong Answers Only",
    "text": "Someone puts googly eyes on the office stapler.\n\nWhat would {name} make the stapler say?"
  },
  {
    "id": "p233",
    "category": "Wrong Answers Only",
    "text": "An umbrella turns inside out on a windy day.\n\nWhat would {name} pretend it was designed to do?"
  },
  {
    "id": "p234",
    "category": "Wrong Answers Only",
    "text": "The host asks you to bring a gift that costs nothing.\n\nWhat silly gift would {name} bring?"
  },
  {
    "id": "p235",
    "category": "Wrong Answers Only",
    "text": "A plant on the windowsill barely grows for months.\n\nWhat excuse would {name} give on the plant's behalf?"
  },
  {
    "id": "p236",
    "category": "Wrong Answers Only",
    "text": "A rubber duck appears on the kitchen table.\n\nWhat job would {name} assign it?"
  },
  {
    "id": "p237",
    "category": "Wrong Answers Only",
    "text": "A banana shows up in a group photo.\n\nWhat would {name} say the banana was doing there?"
  },
  {
    "id": "p238",
    "category": "Wrong Answers Only",
    "text": "Someone builds a snowman with a spoon for a nose.\n\nWhat would {name} name the snowman?"
  },
  {
    "id": "p239",
    "category": "Wrong Answers Only",
    "text": "The room goes quiet right as your stomach growls.\n\nWhat would {name} blame the sound on?"
  },
  {
    "id": "p240",
    "category": "Wrong Answers Only",
    "text": "The waiter brings one tiny fry on a large plate.\n\nWhat would {name} call this fancy dish?"
  },
  {
    "id": "p241",
    "category": "Wrong Answers Only",
    "text": "Your chair makes a loud squeak every time you sit down.\n\nWhat song would {name} say the chair is trying to play?"
  },
  {
    "id": "p242",
    "category": "Wrong Answers Only",
    "text": "A cat knocks a pen off the desk without looking away.\n\nWhat would {name} say the cat was trying to prove?"
  },
  {
    "id": "p243",
    "category": "Wrong Answers Only",
    "text": "Someone finds a flip-flop in the middle of a parking lot.\n\nWhat would {name} guess happened to its owner?"
  },
  {
    "id": "p244",
    "category": "Wrong Answers Only",
    "text": "A birthday cake has room for only one word.\n\nWhat silly word would {name} put on it?"
  },
  {
    "id": "p245",
    "category": "Wrong Answers Only",
    "text": "You find a pea hiding under your plate.\n\nWhat mission would {name} say the pea was on?"
  },
  {
    "id": "p246",
    "category": "Wrong Answers Only",
    "text": "Your pancake comes out shaped like a shoe.\n\nWhat would {name} call it on a menu?"
  },
  {
    "id": "p247",
    "category": "Wrong Answers Only",
    "text": "The only prize at trivia night is a wooden spoon.\n\nWhat would {name} say in their silly acceptance speech?"
  },
  {
    "id": "p248",
    "category": "Wrong Answers Only",
    "text": "A pigeon lands on the picnic table like it owns the place.\n\nWhat would {name} say the pigeon came to order?"
  },
  {
    "id": "p249",
    "category": "Wrong Answers Only",
    "text": "A tiny hat falls out of a bag of clean clothes.\n\nWho would {name} pretend the hat belongs to?"
  },
  {
    "id": "p250",
    "category": "Wrong Answers Only",
    "text": "Someone wears oven mitts to a handshake contest.\n\nWhat excuse would {name} give for wearing them?"
  },
  {
    "id": "p251",
    "category": "Tiny Businesses",
    "text": "A lemonade stand has only five lemons left.\n\nWhat would {name} do to keep the stand open?"
  },
  {
    "id": "p252",
    "category": "Tiny Businesses",
    "text": "A new bakery needs its first cookie flavor.\n\nWhat flavor would {name} put on the menu?"
  },
  {
    "id": "p253",
    "category": "Tiny Businesses",
    "text": "A neighbor wants to open a late-night snack shop.\n\nWhat snack would {name} sell first?"
  },
  {
    "id": "p254",
    "category": "Tiny Businesses",
    "text": "A tiny flower shop needs a name.\n\nWhat would {name} call it?"
  },
  {
    "id": "p255",
    "category": "Tiny Businesses",
    "text": "A coffee cart can offer one free extra with every drink.\n\nWhat would {name} give away?"
  },
  {
    "id": "p256",
    "category": "Tiny Businesses",
    "text": "A friend opens a shop that only sells socks.\n\nWhat kind of socks would {name} put in the window?"
  },
  {
    "id": "p257",
    "category": "Tiny Businesses",
    "text": "A dog-walking business needs a sign for its first day.\n\nWhat would {name} put on the sign?"
  },
  {
    "id": "p258",
    "category": "Tiny Businesses",
    "text": "A bookstore has space for one comfy chair.\n\nWhere would {name} put it?"
  },
  {
    "id": "p259",
    "category": "Tiny Businesses",
    "text": "A pizza shop lets customers invent one topping combo.\n\nWhat combo would {name} choose?"
  },
  {
    "id": "p260",
    "category": "Tiny Businesses",
    "text": "A food truck needs a catchy name for its grilled cheese.\n\nWhat would {name} call the sandwich?"
  },
  {
    "id": "p261",
    "category": "Tiny Businesses",
    "text": "A thrift shop finds a pile of old lamps.\n\nHow would {name} set them up in the shop window?"
  },
  {
    "id": "p262",
    "category": "Tiny Businesses",
    "text": "A plant shop wants to give every plant a name tag.\n\nWhat would {name} name the first plant?"
  },
  {
    "id": "p263",
    "category": "Tiny Businesses",
    "text": "A donut shop wants a flavor for the weekend.\n\nWhat flavor would {name} pick?"
  },
  {
    "id": "p264",
    "category": "Tiny Businesses",
    "text": "A tiny diner only has room for six seats.\n\nWhat would {name} put on the menu?"
  },
  {
    "id": "p265",
    "category": "Tiny Businesses",
    "text": "A beach shop wants to sell something people always forget.\n\nWhat would {name} stock first?"
  },
  {
    "id": "p266",
    "category": "Tiny Businesses",
    "text": "A new smoothie stand needs a drink for a hot day.\n\nWhat would {name} blend together?"
  },
  {
    "id": "p267",
    "category": "Tiny Businesses",
    "text": "A repair shop opens with a sign that says “We fix almost anything.”\n\nWhat would {name} bring in first?"
  },
  {
    "id": "p268",
    "category": "Tiny Businesses",
    "text": "A new nail salon needs one color to put on its sign.\n\nWhat color would {name} pick?"
  },
  {
    "id": "p269",
    "category": "Tiny Businesses",
    "text": "A neighbor offers to pay you to water their plants.\n\nWhat price would {name} give them?"
  },
  {
    "id": "p270",
    "category": "Tiny Businesses",
    "text": "An ice cream truck wants a new song to play.\n\nWhat song would {name} choose?"
  },
  {
    "id": "p271",
    "category": "Tiny Businesses",
    "text": "A sandwich shop wants to name a sandwich after a customer.\n\nWhat would {name} want on their own sandwich?"
  },
  {
    "id": "p272",
    "category": "Tiny Businesses",
    "text": "A candle shop can add only one new scent.\n\nWhat scent would {name} pick?"
  },
  {
    "id": "p273",
    "category": "Tiny Businesses",
    "text": "A tailor offers to add a pocket to anything.\n\nWhat would {name} bring in?"
  },
  {
    "id": "p274",
    "category": "Tiny Businesses",
    "text": "A gift shop needs a cheap item people will buy on a whim.\n\nWhat would {name} put by the checkout?"
  },
  {
    "id": "p275",
    "category": "Tiny Businesses",
    "text": "A corner store has room for one arcade game.\n\nWhat game would {name} put in?"
  },
  {
    "id": "p276",
    "category": "Public Office",
    "text": "The town gives you money to add one thing to the park.\n\nWhat would {name} add?"
  },
  {
    "id": "p277",
    "category": "Public Office",
    "text": "A neighborhood needs a name for its new street.\n\nWhat would {name} call it?"
  },
  {
    "id": "p278",
    "category": "Public Office",
    "text": "The school lets you choose lunch for the whole cafeteria.\n\nWhat would {name} serve?"
  },
  {
    "id": "p279",
    "category": "Public Office",
    "text": "The town asks residents to choose a mascot.\n\nWhat mascot would {name} suggest?"
  },
  {
    "id": "p280",
    "category": "Public Office",
    "text": "You get to pick the music for the town parade.\n\nWhat song would {name} play first?"
  },
  {
    "id": "p281",
    "category": "Public Office",
    "text": "The library asks what it should lend besides books.\n\nWhat would {name} add to the shelves?"
  },
  {
    "id": "p282",
    "category": "Public Office",
    "text": "The park wants a sign that reminds people to clean up after their dogs.\n\nWhat would {name} write on it?"
  },
  {
    "id": "p283",
    "category": "Public Office",
    "text": "The town is planning a movie night outside.\n\nWhat movie would {name} put on?"
  },
  {
    "id": "p284",
    "category": "Public Office",
    "text": "You get to pick one new rule for the community pool.\n\nWhat rule would {name} make?"
  },
  {
    "id": "p285",
    "category": "Public Office",
    "text": "The playground has room for one more piece of equipment.\n\nWhat would {name} install?"
  },
  {
    "id": "p286",
    "category": "Public Office",
    "text": "A bus stop needs something to make waiting nicer.\n\nWhat would {name} add?"
  },
  {
    "id": "p287",
    "category": "Public Office",
    "text": "The school lets you move one holiday to a different time of year.\n\nWhich holiday would {name} move?"
  },
  {
    "id": "p288",
    "category": "Public Office",
    "text": "The neighborhood gets to pick a name for its newsletter.\n\nWhat would {name} call it?"
  },
  {
    "id": "p289",
    "category": "Public Office",
    "text": "A public garden has one empty flower bed.\n\nWhat would {name} plant there?"
  },
  {
    "id": "p290",
    "category": "Public Office",
    "text": "A town council has money to paint one wall downtown.\n\nWhat would {name} paint on it?"
  },
  {
    "id": "p291",
    "category": "Public Office",
    "text": "The community center can offer one free class.\n\nWhat class would {name} pick?"
  },
  {
    "id": "p292",
    "category": "Public Office",
    "text": "A street festival needs a snack stand.\n\nWhat snack would {name} sell there?"
  },
  {
    "id": "p293",
    "category": "Public Office",
    "text": "A school needs a new name for its sports team.\n\nWhat name would {name} suggest?"
  },
  {
    "id": "p294",
    "category": "Public Office",
    "text": "The park is getting a bench with a short message on it.\n\nWhat would {name} write?"
  },
  {
    "id": "p295",
    "category": "Public Office",
    "text": "You get to open the town fair with one sentence.\n\nWhat would {name} say to the crowd?"
  },
  {
    "id": "p296",
    "category": "Public Office",
    "text": "The town has an old clock tower that doesn't work.\n\nWhat would {name} do with it?"
  },
  {
    "id": "p297",
    "category": "Public Office",
    "text": "The library wants to keep people from talking too loudly.\n\nWhat funny reminder would {name} put by the door?"
  },
  {
    "id": "p298",
    "category": "Public Office",
    "text": "A school votes on one dress-up day for the year.\n\nWhat theme would {name} choose?"
  },
  {
    "id": "p299",
    "category": "Public Office",
    "text": "The city turns one parking space into a spot to sit.\n\nHow would {name} decorate it?"
  },
  {
    "id": "p300",
    "category": "Public Office",
    "text": "The town invites suggestions for next year's festival.\n\nWhat would {name} put on the schedule?"
  },
  {
    "id": "p301",
    "category": "Superpowers",
    "text": "A friend drops their ice cream, but time can be rewound ten seconds.\n\nWhat would {name} do?"
  },
  {
    "id": "p302",
    "category": "Superpowers",
    "text": "A friend just called a cab, but flying is an option.\n\nWhat would {name} tell their friend?"
  },
  {
    "id": "p303",
    "category": "Superpowers",
    "text": "Invisibility works for one minute at a party.\n\nWhat would {name} use that minute for?"
  },
  {
    "id": "p304",
    "category": "Superpowers",
    "text": "It's possible to make an extra copy of yourself for one day.\n\nWhat would {name} send their copy to do?"
  },
  {
    "id": "p305",
    "category": "Superpowers",
    "text": "It's possible to know exactly when the next bus will arrive.\n\nWhat would {name} say to a friend who wants to start walking?"
  },
  {
    "id": "p306",
    "category": "Superpowers",
    "text": "One item can be teleported from home to work.\n\nWhat would {name} bring over?"
  },
  {
    "id": "p307",
    "category": "Superpowers",
    "text": "Animals can talk back, and a squirrel is staring at lunch.\n\nWhat would {name} ask the squirrel?"
  },
  {
    "id": "p308",
    "category": "Superpowers",
    "text": "The weather can be changed for a birthday picnic.\n\nWhat would {name} choose?"
  },
  {
    "id": "p309",
    "category": "Superpowers",
    "text": "Time can be frozen right before the alarm goes off.\n\nWhat would {name} do with the extra time?"
  },
  {
    "id": "p310",
    "category": "Superpowers",
    "text": "Any meal can be cooked perfectly just by looking at the ingredients.\n\nWhat would {name} make for dinner?"
  },
  {
    "id": "p311",
    "category": "Superpowers",
    "text": "It's possible to see inside wrapped birthday gifts.\n\nWhose gift would {name} peek at first?"
  },
  {
    "id": "p312",
    "category": "Superpowers",
    "text": "On vacation, every language suddenly makes sense.\n\nWhat would {name} do first?"
  },
  {
    "id": "p313",
    "category": "Superpowers",
    "text": "Furniture can be moved with a thought.\n\nWhat would {name} rearrange at home?"
  },
  {
    "id": "p314",
    "category": "Superpowers",
    "text": "Any drink can be refilled without leaving the couch.\n\nWhat drink would {name} keep refilling?"
  },
  {
    "id": "p315",
    "category": "Superpowers",
    "text": "Any traffic light can be turned green on demand.\n\nWhere would {name} want the power most?"
  },
  {
    "id": "p316",
    "category": "Superpowers",
    "text": "One thing can be shrunk to fit in a pocket.\n\nWhat would {name} shrink before a trip?"
  },
  {
    "id": "p317",
    "category": "Superpowers",
    "text": "It's possible to run as fast as a car.\n\nWhat errand would {name} run first?"
  },
  {
    "id": "p318",
    "category": "Superpowers",
    "text": "A snap of the fingers can clean a whole room.\n\nWhich room would {name} clean first?"
  },
  {
    "id": "p319",
    "category": "Superpowers",
    "text": "Anything broken can be fixed by tapping it twice.\n\nWhat broken thing would {name} fix first?"
  },
  {
    "id": "p320",
    "category": "Superpowers",
    "text": "For one hour, it's possible to hear what others are saying about you.\n\nWould {name} listen or turn it off?"
  },
  {
    "id": "p321",
    "category": "Superpowers",
    "text": "One person can be kept dry even in pouring rain.\n\nWho would {name} keep dry on a rainy day?"
  },
  {
    "id": "p322",
    "category": "Superpowers",
    "text": "A song can start playing just by thinking about it.\n\nWhat song would {name} play at a quiet party?"
  },
  {
    "id": "p323",
    "category": "Superpowers",
    "text": "Any fruit can grow in under a minute.\n\nWhat would {name} grow for a snack?"
  },
  {
    "id": "p324",
    "category": "Superpowers",
    "text": "A favorite meal can appear out of thin air once a day.\n\nWhen would {name} use that power?"
  },
  {
    "id": "p325",
    "category": "Superpowers",
    "text": "It's possible to fall asleep instantly, anywhere.\n\nWhere would {name} try it first?"
  },
  {
    "id": "p326",
    "category": "Pets and Plants",
    "text": "Your dog steals your seat every time you get up.\n\nWhat would {name} do to get their seat back?"
  },
  {
    "id": "p327",
    "category": "Pets and Plants",
    "text": "A neighbor asks you to babysit their very loud parrot.\n\nWhat would {name} say?"
  },
  {
    "id": "p328",
    "category": "Pets and Plants",
    "text": "Your cat jumps into the laundry basket right after you fold everything.\n\nWhat would {name} do?"
  },
  {
    "id": "p329",
    "category": "Pets and Plants",
    "text": "Your friend gives you a plant with no care instructions.\n\nWhere would {name} put it?"
  },
  {
    "id": "p330",
    "category": "Pets and Plants",
    "text": "A puppy chews up one of your favorite shoes.\n\nWhat would {name} say to the puppy?"
  },
  {
    "id": "p331",
    "category": "Pets and Plants",
    "text": "A stray cat follows you all the way home.\n\nWhat would {name} do when they reach the door?"
  },
  {
    "id": "p332",
    "category": "Pets and Plants",
    "text": "Your dog brings a muddy stick into the living room.\n\nWhat would {name} do first?"
  },
  {
    "id": "p333",
    "category": "Pets and Plants",
    "text": "Your roommate’s plant grows sideways across your desk.\n\nWhat would {name} say to their roommate?"
  },
  {
    "id": "p334",
    "category": "Pets and Plants",
    "text": "You find a tiny frog in your backyard.\n\nWhat would {name} do with it?"
  },
  {
    "id": "p335",
    "category": "Pets and Plants",
    "text": "Your dog keeps barking at its reflection.\n\nHow would {name} try to calm it down?"
  },
  {
    "id": "p336",
    "category": "Pets and Plants",
    "text": "Someone offers you a free pet fish.\n\nWould {name} take it or pass?"
  },
  {
    "id": "p337",
    "category": "Pets and Plants",
    "text": "Your dog refuses to walk any farther and sits down.\n\nHow would {name} get the dog moving?"
  },
  {
    "id": "p338",
    "category": "Pets and Plants",
    "text": "Your cat knocks a glass off the table while looking right at you.\n\nWhat would {name} say to the cat?"
  },
  {
    "id": "p339",
    "category": "Pets and Plants",
    "text": "You accidentally buy a giant plant that barely fits through the door.\n\nWhere would {name} put it?"
  },
  {
    "id": "p340",
    "category": "Pets and Plants",
    "text": "A friend says their dog counts as a plus-one at your party.\n\nWhat would {name} tell them?"
  },
  {
    "id": "p341",
    "category": "Pets and Plants",
    "text": "Your cat climbs into your suitcase while you’re packing.\n\nWhat would {name} do?"
  },
  {
    "id": "p342",
    "category": "Pets and Plants",
    "text": "A puppy falls asleep on your lap when you need to leave.\n\nWould {name} move it or wait?"
  },
  {
    "id": "p343",
    "category": "Pets and Plants",
    "text": "You catch your dog digging in the garden you planted yesterday.\n\nWhat would {name} do next?"
  },
  {
    "id": "p344",
    "category": "Pets and Plants",
    "text": "Your friend’s pet rabbit hops under the couch and won’t come out.\n\nHow would {name} lure it out?"
  },
  {
    "id": "p345",
    "category": "Pets and Plants",
    "text": "A neighbor leaves you in charge of watering their plants for a week.\n\nHow would {name} remember to water them?"
  },
  {
    "id": "p346",
    "category": "Pets and Plants",
    "text": "Your pet refuses the expensive new food you just bought.\n\nWhat would {name} try next?"
  },
  {
    "id": "p347",
    "category": "Pets and Plants",
    "text": "The pet store sells matching sweaters for you and your dog.\n\nWould {name} buy them?"
  },
  {
    "id": "p348",
    "category": "Pets and Plants",
    "text": "Your cat crawls into an empty box and ignores the toy you bought.\n\nWhat would {name} do with the toy?"
  },
  {
    "id": "p349",
    "category": "Pets and Plants",
    "text": "A plant you thought was dead grows one new leaf.\n\nWhat would {name} do next?"
  },
  {
    "id": "p350",
    "category": "Pets and Plants",
    "text": "Your dog brings its favorite toy to the dinner table.\n\nWould {name} let it stay there?"
  },
  {
    "id": "p351",
    "category": "Odd Jobs",
    "text": "Your first customer at the lemonade stand pays with a pile of coins.\n\nWhat would {name} say?"
  },
  {
    "id": "p352",
    "category": "Odd Jobs",
    "text": "You’re running a photo booth, and nobody knows how to pose.\n\nWhat pose would {name} suggest?"
  },
  {
    "id": "p353",
    "category": "Odd Jobs",
    "text": "Your first day as a dog walker starts with pouring rain.\n\nWhat would {name} bring?"
  },
  {
    "id": "p354",
    "category": "Odd Jobs",
    "text": "You’re hired to hand out samples of your favorite snack.\n\nWhat would {name} say to get people to try it?"
  },
  {
    "id": "p355",
    "category": "Odd Jobs",
    "text": "You’re helping a friend at a yard sale, and someone offers a dollar for their favorite chair.\n\nWhat would {name} say?"
  },
  {
    "id": "p356",
    "category": "Odd Jobs",
    "text": "You’re paid to hold a sign outside a pizza shop.\n\nHow would {name} get people to look?"
  },
  {
    "id": "p357",
    "category": "Odd Jobs",
    "text": "A movie theater lets you pick the next film for staff movie night.\n\nWhat would {name} choose?"
  },
  {
    "id": "p358",
    "category": "Odd Jobs",
    "text": "You’re selling ice cream on a hot day and run out of chocolate.\n\nWhat flavor would {name} recommend instead?"
  },
  {
    "id": "p359",
    "category": "Odd Jobs",
    "text": "You’re wrapping gifts at a store, and a customer hands you a basketball.\n\nHow would {name} wrap it?"
  },
  {
    "id": "p360",
    "category": "Odd Jobs",
    "text": "You’re hired to DJ at a quiet backyard party.\n\nWhat song would {name} play first?"
  },
  {
    "id": "p361",
    "category": "Odd Jobs",
    "text": "You’re asked to read a bedtime story to a room full of kids.\n\nWhat would {name} pick?"
  },
  {
    "id": "p362",
    "category": "Odd Jobs",
    "text": "You’re helping at a bakery, and a batch of cookies comes out lopsided.\n\nWhat would {name} do with them?"
  },
  {
    "id": "p363",
    "category": "Odd Jobs",
    "text": "You’re in charge of naming the new drinks at a coffee shop.\n\nWhat name would {name} give a caramel latte?"
  },
  {
    "id": "p364",
    "category": "Odd Jobs",
    "text": "You’re running a coat check, and there are ten identical black jackets.\n\nHow would {name} keep track of them?"
  },
  {
    "id": "p365",
    "category": "Odd Jobs",
    "text": "You’re working at a flower shop, and someone needs a quick apology gift.\n\nWhat would {name} suggest?"
  },
  {
    "id": "p366",
    "category": "Odd Jobs",
    "text": "You’re leading a tour in your hometown.\n\nWhat place would {name} show off first?"
  },
  {
    "id": "p367",
    "category": "Odd Jobs",
    "text": "You’re hired to wear a mascot costume for a day.\n\nWhat would {name} do when kids ask for a dance?"
  },
  {
    "id": "p368",
    "category": "Odd Jobs",
    "text": "You’re pet-sitting, and the owner left a very detailed bedtime routine for their cat.\n\nWould {name} follow it exactly?"
  },
  {
    "id": "p369",
    "category": "Odd Jobs",
    "text": "You’re asked to decorate cupcakes for a birthday party.\n\nWhat design would {name} pick?"
  },
  {
    "id": "p370",
    "category": "Odd Jobs",
    "text": "You’re running bingo, and three people shout bingo at once.\n\nWhat would {name} do?"
  },
  {
    "id": "p371",
    "category": "Odd Jobs",
    "text": "A friend asks you to photograph their birthday party with an old camera.\n\nWhat moment would {name} make sure to capture?"
  },
  {
    "id": "p372",
    "category": "Odd Jobs",
    "text": "You’re helping paint a room, and your friend asks you to choose the color.\n\nWhat would {name} pick?"
  },
  {
    "id": "p373",
    "category": "Odd Jobs",
    "text": "You’re hired to pack lunch for a picky eater.\n\nWhat would {name} put in the lunchbox?"
  },
  {
    "id": "p374",
    "category": "Odd Jobs",
    "text": "You’re giving out free T-shirts and only have extra-large sizes left.\n\nWhat would {name} tell the next person in line?"
  },
  {
    "id": "p375",
    "category": "Odd Jobs",
    "text": "You’re in charge of music at the grocery store for an afternoon.\n\nWhat would {name} put on?"
  },
  {
    "id": "p376",
    "category": "Tech Glitches",
    "text": "Your phone autocorrects “see you soon” to “see you soup.”\n\nWhat would {name} text next?"
  },
  {
    "id": "p377",
    "category": "Tech Glitches",
    "text": "The TV remote stops working right when the game starts.\n\nWhat would {name} try first?"
  },
  {
    "id": "p378",
    "category": "Tech Glitches",
    "text": "Your phone is at one percent and you’re still waiting for your ride.\n\nWhat would {name} do?"
  },
  {
    "id": "p379",
    "category": "Tech Glitches",
    "text": "Your video call freezes on a weird face.\n\nWhat would {name} say when the picture comes back?"
  },
  {
    "id": "p380",
    "category": "Tech Glitches",
    "text": "Your alarm doesn’t go off on the morning of an important meeting.\n\nWhat would {name} do first?"
  },
  {
    "id": "p381",
    "category": "Tech Glitches",
    "text": "The printer spits out ten copies when you only wanted one.\n\nWhat would {name} do with the extras?"
  },
  {
    "id": "p382",
    "category": "Tech Glitches",
    "text": "Your navigation app tells you to make three U-turns in a row.\n\nWould {name} keep following it?"
  },
  {
    "id": "p383",
    "category": "Tech Glitches",
    "text": "You accidentally hit reply all instead of replying to one person.\n\nWhat would {name} do next?"
  },
  {
    "id": "p384",
    "category": "Tech Glitches",
    "text": "Your friend’s microphone is muted while they tell a long story.\n\nHow would {name} let them know?"
  },
  {
    "id": "p385",
    "category": "Tech Glitches",
    "text": "Your phone keeps connecting to your friend’s speaker instead of your headphones.\n\nWhat would {name} say to their friend?"
  },
  {
    "id": "p386",
    "category": "Tech Glitches",
    "text": "A software update starts right before you’re about to watch a movie.\n\nWhat would {name} do while they wait?"
  },
  {
    "id": "p387",
    "category": "Tech Glitches",
    "text": "You get logged out and can’t remember which email you used to sign up.\n\nWhat would {name} try first?"
  },
  {
    "id": "p388",
    "category": "Tech Glitches",
    "text": "A delivery app sends your dinner to the wrong building.\n\nWhat would {name} do?"
  },
  {
    "id": "p389",
    "category": "Tech Glitches",
    "text": "Your laptop keeps making a noise you can’t identify.\n\nWho would {name} ask for help?"
  },
  {
    "id": "p390",
    "category": "Tech Glitches",
    "text": "Your keyboard is missing the letter E for the rest of the day.\n\nWhat would {name} do?"
  },
  {
    "id": "p391",
    "category": "Tech Glitches",
    "text": "The Wi-Fi stops working while everyone’s watching the same show.\n\nWhat would {name} suggest doing instead?"
  },
  {
    "id": "p392",
    "category": "Tech Glitches",
    "text": "Your phone thinks you’re still running after you’ve stopped for snacks.\n\nWhat would {name} do with the workout log?"
  },
  {
    "id": "p393",
    "category": "Tech Glitches",
    "text": "Your friend sends a video but the sound doesn’t work.\n\nWhat would {name} reply?"
  },
  {
    "id": "p394",
    "category": "Tech Glitches",
    "text": "Your smart speaker plays a random song instead of setting a timer.\n\nWhat would {name} say next?"
  },
  {
    "id": "p395",
    "category": "Tech Glitches",
    "text": "Your only charger stops working on a trip.\n\nWho would {name} ask to borrow one from?"
  },
  {
    "id": "p396",
    "category": "Tech Glitches",
    "text": "Your wireless headphones run out of battery halfway through a flight.\n\nWhat would {name} do next?"
  },
  {
    "id": "p397",
    "category": "Tech Glitches",
    "text": "Your camera is on during a call, but you thought it was off.\n\nWhat would {name} do when they notice?"
  },
  {
    "id": "p398",
    "category": "Tech Glitches",
    "text": "A streaming app skips to the last episode of a show you’re starting.\n\nWhat would {name} do to avoid spoilers?"
  },
  {
    "id": "p399",
    "category": "Tech Glitches",
    "text": "There’s no signal when you try to open your ticket at the door.\n\nWhat would {name} say to the person checking tickets?"
  },
  {
    "id": "p400",
    "category": "Tech Glitches",
    "text": "You sent a friend the wrong screenshot.\n\nWhat would {name} text them next?"
  },
  {
    "id": "p401",
    "category": "Low-Stakes Debates",
    "text": "Your friends are arguing over whether pineapple belongs on pizza.\n\nWhich side would {name} take?"
  },
  {
    "id": "p402",
    "category": "Low-Stakes Debates",
    "text": "Someone wants the window open, but someone else is freezing.\n\nWhat would {name} do?"
  },
  {
    "id": "p403",
    "category": "Low-Stakes Debates",
    "text": "Two friends reach for the last fry at the same time.\n\nHow would {name} settle it?"
  },
  {
    "id": "p404",
    "category": "Low-Stakes Debates",
    "text": "The group can't choose between the beach and the pool.\n\nWhich would {name} pick?"
  },
  {
    "id": "p405",
    "category": "Low-Stakes Debates",
    "text": "Your friends disagree about whether a hot dog is a sandwich.\n\nWhat would {name} say?"
  },
  {
    "id": "p406",
    "category": "Low-Stakes Debates",
    "text": "Half the car wants music and half wants quiet.\n\nWhat would {name} suggest?"
  },
  {
    "id": "p407",
    "category": "Low-Stakes Debates",
    "text": "The group is split between watching a movie and playing a game.\n\nWhich would {name} choose?"
  },
  {
    "id": "p408",
    "category": "Low-Stakes Debates",
    "text": "Your friends can't agree on where to order dinner.\n\nWhat would {name} order?"
  },
  {
    "id": "p409",
    "category": "Low-Stakes Debates",
    "text": "Someone says breakfast food should never be eaten at night.\n\nWould {name} agree?"
  },
  {
    "id": "p410",
    "category": "Low-Stakes Debates",
    "text": "Two friends disagree about whether to keep their shoes on indoors.\n\nWhat rule would {name} make?"
  },
  {
    "id": "p411",
    "category": "Low-Stakes Debates",
    "text": "The group is arguing over whether to recline on a plane.\n\nWhat would {name} say?"
  },
  {
    "id": "p412",
    "category": "Low-Stakes Debates",
    "text": "The cake has one huge corner piece and one small middle piece left.\n\nWhich piece would {name} take?"
  },
  {
    "id": "p413",
    "category": "Low-Stakes Debates",
    "text": "The group can't choose a start time for brunch.\n\nWhat time would {name} pick?"
  },
  {
    "id": "p414",
    "category": "Low-Stakes Debates",
    "text": "Your friends disagree on whether to split the bill evenly.\n\nWhat would {name} suggest?"
  },
  {
    "id": "p415",
    "category": "Low-Stakes Debates",
    "text": "Someone always puts ketchup on eggs and everyone notices.\n\nWhat would {name} say?"
  },
  {
    "id": "p416",
    "category": "Low-Stakes Debates",
    "text": "The group is deciding between a sunrise hike and sleeping in.\n\nWhich would {name} pick?"
  },
  {
    "id": "p417",
    "category": "Low-Stakes Debates",
    "text": "Your friends are arguing over the best ice cream flavor.\n\nWhat flavor would {name} defend?"
  },
  {
    "id": "p418",
    "category": "Low-Stakes Debates",
    "text": "One friend insists the group needs a photo before anyone eats.\n\nWhat would {name} do?"
  },
  {
    "id": "p419",
    "category": "Low-Stakes Debates",
    "text": "Your friends can't agree on whether to watch the movie with subtitles.\n\nWhat would {name} choose?"
  },
  {
    "id": "p420",
    "category": "Low-Stakes Debates",
    "text": "The group is debating whether to stop for coffee on a road trip.\n\nWhat would {name} vote for?"
  },
  {
    "id": "p421",
    "category": "Low-Stakes Debates",
    "text": "Your friends are deciding who gets the front seat.\n\nHow would {name} decide?"
  },
  {
    "id": "p422",
    "category": "Low-Stakes Debates",
    "text": "Someone says a birthday party doesn't need cake.\n\nHow would {name} respond?"
  },
  {
    "id": "p423",
    "category": "Low-Stakes Debates",
    "text": "The group is arguing over whether naps make the day better or worse.\n\nWhat would {name} say?"
  },
  {
    "id": "p424",
    "category": "Low-Stakes Debates",
    "text": "One friend wants the lights on and another wants them off.\n\nWhat would {name} do?"
  },
  {
    "id": "p425",
    "category": "Low-Stakes Debates",
    "text": "Your friends are deciding whether to make dinner or order takeout.\n\nWhat would {name} pick?"
  },
  {
    "id": "p426",
    "category": "Tiny Wins",
    "text": "You get the last parking spot right by the entrance.\n\nHow would {name} celebrate?"
  },
  {
    "id": "p427",
    "category": "Tiny Wins",
    "text": "You find twenty dollars in an old coat pocket.\n\nWhat would {name} spend it on?"
  },
  {
    "id": "p428",
    "category": "Tiny Wins",
    "text": "The barista gives you an extra pastry for free.\n\nWhat would {name} do with it?"
  },
  {
    "id": "p429",
    "category": "Tiny Wins",
    "text": "Your food arrives exactly when you were about to ask about it.\n\nWhat would {name} say?"
  },
  {
    "id": "p430",
    "category": "Tiny Wins",
    "text": "You finally open a jar nobody else could open.\n\nHow would {name} react?"
  },
  {
    "id": "p431",
    "category": "Tiny Wins",
    "text": "You get home right before it starts pouring.\n\nWhat would {name} say?"
  },
  {
    "id": "p432",
    "category": "Tiny Wins",
    "text": "The vending machine drops two snacks for the price of one.\n\nWho would {name} give the extra snack to?"
  },
  {
    "id": "p433",
    "category": "Tiny Wins",
    "text": "Your friends decide to cancel plans on a night you wanted to stay home.\n\nWhat would {name} do next?"
  },
  {
    "id": "p434",
    "category": "Tiny Wins",
    "text": "The restaurant says there's no wait even though you forgot to book.\n\nWhat would {name} say?"
  },
  {
    "id": "p435",
    "category": "Tiny Wins",
    "text": "Your suitcase is the first one out at baggage claim.\n\nHow would {name} react?"
  },
  {
    "id": "p436",
    "category": "Tiny Wins",
    "text": "You catch a glass right before it hits the floor.\n\nWhat would {name} say?"
  },
  {
    "id": "p437",
    "category": "Tiny Wins",
    "text": "The waiter remembers your usual order.\n\nHow would {name} react?"
  },
  {
    "id": "p438",
    "category": "Tiny Wins",
    "text": "You finally find the other half of your favorite pair of socks.\n\nWhat would {name} do?"
  },
  {
    "id": "p439",
    "category": "Tiny Wins",
    "text": "You finish every errand an hour earlier than expected.\n\nHow would {name} spend the extra hour?"
  },
  {
    "id": "p440",
    "category": "Tiny Wins",
    "text": "A stranger gives your outfit a compliment.\n\nWhat would {name} say back?"
  },
  {
    "id": "p441",
    "category": "Tiny Wins",
    "text": "You win a small prize at a fair.\n\nWhere would {name} put it?"
  },
  {
    "id": "p442",
    "category": "Tiny Wins",
    "text": "You get a better seat for free at a show.\n\nWho would {name} text first?"
  },
  {
    "id": "p443",
    "category": "Tiny Wins",
    "text": "You make dinner without needing to look up the recipe.\n\nHow would {name} celebrate?"
  },
  {
    "id": "p444",
    "category": "Tiny Wins",
    "text": "You finally beat a friend at a game they always win.\n\nWhat would {name} say to them?"
  },
  {
    "id": "p445",
    "category": "Tiny Wins",
    "text": "The shop has one last pair of shoes in your size.\n\nWhat would {name} do?"
  },
  {
    "id": "p446",
    "category": "Tiny Wins",
    "text": "Your best friend remembers your coffee order.\n\nWhat would {name} say to them?"
  },
  {
    "id": "p447",
    "category": "Tiny Wins",
    "text": "You make the green light at every intersection on your way home.\n\nWhat would {name} say to the person riding with them?"
  },
  {
    "id": "p448",
    "category": "Tiny Wins",
    "text": "You find a missing earring in the bottom of your bag.\n\nHow would {name} react?"
  },
  {
    "id": "p449",
    "category": "Tiny Wins",
    "text": "The package you've been waiting for shows up a day early.\n\nWhat would {name} do first?"
  },
  {
    "id": "p450",
    "category": "Tiny Wins",
    "text": "Your friend sends back a photo where you both look great.\n\nWhat would {name} do with it?"
  },
  {
    "id": "p451",
    "category": "Alternate Worlds",
    "text": "Everyone in town has to wear pajamas on Mondays.\n\nWhat would {name} wear?"
  },
  {
    "id": "p452",
    "category": "Alternate Worlds",
    "text": "Restaurants serve dessert before dinner.\n\nWhat would {name} order first?"
  },
  {
    "id": "p453",
    "category": "Alternate Worlds",
    "text": "Your dog can text you while you're at work.\n\nWhat message would {name} get first?"
  },
  {
    "id": "p454",
    "category": "Alternate Worlds",
    "text": "Every time you enter a room, a song plays.\n\nWhat song would {name} choose?"
  },
  {
    "id": "p455",
    "category": "Alternate Worlds",
    "text": "All weddings have a bouncy castle.\n\nWhat would {name} do at the reception?"
  },
  {
    "id": "p456",
    "category": "Alternate Worlds",
    "text": "Every plane has a quiet section where talking is not allowed.\n\nWhich part of the plane would {name} sit in?"
  },
  {
    "id": "p457",
    "category": "Alternate Worlds",
    "text": "All stores give a sticker to grown-ups who wait in line nicely.\n\nWhere would {name} put their sticker?"
  },
  {
    "id": "p458",
    "category": "Alternate Worlds",
    "text": "Every hotel lets guests choose the room's theme.\n\nWhat theme would {name} pick?"
  },
  {
    "id": "p459",
    "category": "Alternate Worlds",
    "text": "Everyone gets one extra day off every month.\n\nWhat would {name} do with it?"
  },
  {
    "id": "p460",
    "category": "Alternate Worlds",
    "text": "Bills at restaurants can be paid in jokes instead of cash.\n\nWhat joke would {name} tell?"
  },
  {
    "id": "p461",
    "category": "Alternate Worlds",
    "text": "All clocks are set ten minutes ahead by law.\n\nWould {name} still run late?"
  },
  {
    "id": "p462",
    "category": "Alternate Worlds",
    "text": "A talking mailbox greets you whenever you walk past it.\n\nWhat would {name} say back?"
  },
  {
    "id": "p463",
    "category": "Alternate Worlds",
    "text": "All school reunions take place at a theme park.\n\nWhere would {name} go first?"
  },
  {
    "id": "p464",
    "category": "Alternate Worlds",
    "text": "Your fridge compliments you every time you open it.\n\nWhat compliment would {name} want to hear?"
  },
  {
    "id": "p465",
    "category": "Alternate Worlds",
    "text": "People vote on which song plays in every elevator.\n\nWhat song would {name} vote for?"
  },
  {
    "id": "p466",
    "category": "Alternate Worlds",
    "text": "Every movie theater lets you bring one pet.\n\nWhat animal would {name} bring?"
  },
  {
    "id": "p467",
    "category": "Alternate Worlds",
    "text": "Your neighborhood has a holiday where everyone trades snacks.\n\nWhat snack would {name} bring?"
  },
  {
    "id": "p468",
    "category": "Alternate Worlds",
    "text": "Every house has a slide instead of stairs going down.\n\nWould {name} ask guests to try the slide?"
  },
  {
    "id": "p469",
    "category": "Alternate Worlds",
    "text": "You get to choose the color of the sky for one day.\n\nWhat color would {name} pick?"
  },
  {
    "id": "p470",
    "category": "Alternate Worlds",
    "text": "Every coffee order includes a free tiny toy.\n\nWhat toy would {name} hope to get?"
  },
  {
    "id": "p471",
    "category": "Alternate Worlds",
    "text": "Everyone gets a star on the sidewalk for something they're good at.\n\nWhat would {name}'s star say?"
  },
  {
    "id": "p472",
    "category": "Alternate Worlds",
    "text": "Your town has a parade celebrating people who take good naps.\n\nWhat would {name} wear to it?"
  },
  {
    "id": "p473",
    "category": "Alternate Worlds",
    "text": "Grocery carts play music like ice cream trucks.\n\nWhat song would {name} pick for their cart?"
  },
  {
    "id": "p474",
    "category": "Alternate Worlds",
    "text": "Every birthday cake comes with a tiny edible picture of the guest of honor.\n\nWhat photo would {name} choose?"
  },
  {
    "id": "p475",
    "category": "Alternate Worlds",
    "text": "Everyone's alarm clock can only play a friend's voice.\n\nWhich friend would {name} choose?"
  },
  {
    "id": "p476",
    "category": "Goodbyes",
    "text": "A friend is moving away and asks for one song for the drive.\n\nWhat song would {name} send?"
  },
  {
    "id": "p477",
    "category": "Goodbyes",
    "text": "The group is taking one last photo before everyone leaves.\n\nWhat pose would {name} do?"
  },
  {
    "id": "p478",
    "category": "Goodbyes",
    "text": "A friend is leaving town and you have time for one more meal together.\n\nWhere would {name} want to go?"
  },
  {
    "id": "p479",
    "category": "Goodbyes",
    "text": "You get one line to write in a friend's goodbye card.\n\nWhat would {name} write?"
  },
  {
    "id": "p480",
    "category": "Goodbyes",
    "text": "A friend is packing up and asks for one snack for the road.\n\nWhat snack would {name} bring?"
  },
  {
    "id": "p481",
    "category": "Goodbyes",
    "text": "Everyone is giving a short toast before a friend moves away.\n\nWhat would {name} say?"
  },
  {
    "id": "p482",
    "category": "Goodbyes",
    "text": "A friend is leaving and asks what local food they'll miss most.\n\nWhat would {name} tell them?"
  },
  {
    "id": "p483",
    "category": "Goodbyes",
    "text": "It's the last morning of a trip with friends.\n\nWhat would {name} want to do before leaving?"
  },
  {
    "id": "p484",
    "category": "Goodbyes",
    "text": "A friend is about to board and says they don't like long goodbyes.\n\nWhat would {name} say?"
  },
  {
    "id": "p485",
    "category": "Goodbyes",
    "text": "Your group wants a keepsake from a trip you just finished.\n\nWhat would {name} keep?"
  },
  {
    "id": "p486",
    "category": "Goodbyes",
    "text": "A friend says to call them whenever you miss them.\n\nWhen would {name} make the first call?"
  },
  {
    "id": "p487",
    "category": "Goodbyes",
    "text": "Your group can take one thing from an old apartment before moving out.\n\nWhat would {name} take?"
  },
  {
    "id": "p488",
    "category": "Goodbyes",
    "text": "A coworker is leaving and the office is signing a card.\n\nWhat would {name} write?"
  },
  {
    "id": "p489",
    "category": "Goodbyes",
    "text": "It's the last night at your favorite restaurant before it closes.\n\nWhat would {name} order?"
  },
  {
    "id": "p490",
    "category": "Goodbyes",
    "text": "Your childhood friend is moving and you find an old photo together.\n\nWhat would {name} text with the photo?"
  },
  {
    "id": "p491",
    "category": "Goodbyes",
    "text": "A friend moves away and asks for ideas for your first visit.\n\nWhat would {name} want to do together?"
  },
  {
    "id": "p492",
    "category": "Goodbyes",
    "text": "A friend is leaving your city but still wants to be in the group chat.\n\nWhat would {name} name the chat?"
  },
  {
    "id": "p493",
    "category": "Goodbyes",
    "text": "Your friends are each giving one small gift to someone moving away.\n\nWhat would {name} bring?"
  },
  {
    "id": "p494",
    "category": "Goodbyes",
    "text": "A friend asks what you'll miss most about having them nearby.\n\nWhat would {name} tell them?"
  },
  {
    "id": "p495",
    "category": "Goodbyes",
    "text": "Everyone is saying goodbye after a long weekend together.\n\nWho would {name} hug first?"
  },
  {
    "id": "p496",
    "category": "Goodbyes",
    "text": "A friend asks you to choose the first thing they should unpack in their new place.\n\nWhat would {name} tell them to unpack?"
  },
  {
    "id": "p497",
    "category": "Goodbyes",
    "text": "Someone at a goodbye dinner wants to make one last silly bet.\n\nWhat would {name} bet on?"
  },
  {
    "id": "p498",
    "category": "Goodbyes",
    "text": "A friend is going abroad and asks you to mail them something from home.\n\nWhat would {name} send?"
  },
  {
    "id": "p499",
    "category": "Goodbyes",
    "text": "The group wants to pick a date to see each other again before saying goodbye.\n\nHow soon would {name} try to meet up?"
  },
  {
    "id": "p500",
    "category": "Goodbyes",
    "text": "A friend leaves you a note on their last day in town.\n\nWhat would {name} text back?"
  }
];
