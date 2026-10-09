export const MASCOT_GROUPS = {
  animals: [
    "bear",
    "bunny",
    "cat",
    "deer",
    "dino",
    "fox",
    "frog",
    "hamster",
    "hedgehog",
    "koala",
    "mouse",
    "otter",
    "owl",
    "panda",
    "penguin",
    "pug",
    "raccoon",
    "redpanda",
    "sheep",
    "sloth",
    "tiger",
  ],
  people: [
    "afro",
    "astronaut",
    "bald",
    "ballerina",
    "beard",
    "builder",
    "cap",
    "chef",
    "glasses",
    "grandpa",
    "granny",
    "hijabi",
    "kamran",
    "nurse",
    "pirate",
    "scientist",
    "sikh",
    "skater",
    "wizard",
  ],
  robots: [
    "clockwork",
    "crt",
    "cube",
    "drone",
    "gearbot",
    "knight",
    "lantern",
    "postbot",
    "radio",
    "rocket",
    "scout",
    "toaster",
    "tv",
  ],
  styles: ["fox-ink", "fox-sketch", "fox-riso", "fox-paper", "fox-pixel"],
} as const;

export type MascotGroup = keyof typeof MASCOT_GROUPS;
export type MascotCharacter = (typeof MASCOT_GROUPS)[MascotGroup][number];
export const MASCOT_CHARACTERS = Object.values(
  MASCOT_GROUPS,
).flat() as MascotCharacter[];
export const DEFAULT_MASCOT: MascotCharacter = "fox";

export function mascotCharacter(value: string | null): MascotCharacter {
  const character = value?.startsWith("mascot:") ? value.slice(7) : "";
  return MASCOT_CHARACTERS.includes(character as MascotCharacter)
    ? (character as MascotCharacter)
    : DEFAULT_MASCOT;
}

export function mascotValue(character: MascotCharacter): string {
  return `mascot:${character}`;
}

/** Old generated picks get a stable character; uploaded images remain intact. */
export function normalizeAvatarValue(value: string | null): string | null {
  if (value?.startsWith("blobatar:")) {
    let hash = 2166136261;
    for (const character of value.slice(9))
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    return mascotValue(MASCOT_CHARACTERS[hash % MASCOT_CHARACTERS.length]);
  }
  return value?.startsWith("mascot:")
    ? mascotValue(mascotCharacter(value))
    : value;
}

export function isProfilePhoto(value: string | null): value is string {
  return Boolean(
    value && !value.startsWith("mascot:") && !value.startsWith("blobatar:"),
  );
}

export function profileAssetUrl(path: string, base: string, location: string): string {
  // Electron loads index.html through file://: its directory, not the drive root,
  // owns the bundled assets. HTTP routes still resolve from the server root.
  const page = new URL(location);
  const root = page.protocol === "file:" ? new URL(".", page) : new URL("/", page);
  const assetBase = page.protocol === "file:" ? "./" : base;
  return new URL(`${assetBase}${path}`, root).href;
}
