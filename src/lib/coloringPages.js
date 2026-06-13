import { coloringPages as IMAGE_PAGES } from '../data/coloringPages'

export const CATEGORIES = {
  animals: 'Animals',
  nature: 'Nature',
  space: 'Space',
  fantasy: 'Fantasy',
  mandala: 'Mandala',
  scenes: 'Scenes',
  jungle: 'Jungle',
  dinosaurs: 'Dinosaurs',
}

export const DURATIONS = {
  easy:   { label: 'Quick',   desc: '5 min',   minutes: 7  },
  medium: { label: 'Cozy',    desc: '15 min',  minutes: 20 },
  hard:   { label: 'Big Art', desc: '30+ min', minutes: 45 },
}

// Existing hand-built SVG pages. Image-based pages from src/data/coloringPages.js
// are normalised and merged into COLORING_PAGES below.
const SVG_PAGES = [

  // ── EASY ──────────────────────────────────────────────────────────────────

  {
    id: 'space_kitty',
    name: 'Space Kitty',
    category: 'space',
    duration: 'easy',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<rect width="400" height="400" fill="white"/>
<!-- Small cross stars -->
<g stroke="black" stroke-width="2" stroke-linecap="round">
  <line x1="42" y1="50" x2="42" y2="62"/><line x1="36" y1="56" x2="48" y2="56"/>
  <line x1="355" y1="38" x2="355" y2="50"/><line x1="349" y1="44" x2="361" y2="44"/>
  <line x1="25" y1="200" x2="25" y2="212"/><line x1="19" y1="206" x2="31" y2="206"/>
  <line x1="375" y1="155" x2="375" y2="167"/><line x1="369" y1="161" x2="381" y2="161"/>
  <line x1="375" y1="310" x2="375" y2="322"/><line x1="369" y1="316" x2="381" y2="316"/>
</g>
<!-- Outlined stars -->
<path d="M88 42 L92 54 L104 54 L95 62 L98 74 L88 67 L78 74 L81 62 L72 54 L84 54 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M338 110 L341 120 L351 120 L343 126 L346 136 L338 130 L330 136 L333 126 L325 120 L335 120 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M55 330 L58 340 L68 340 L60 346 L63 356 L55 350 L47 356 L50 346 L42 340 L52 340 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<!-- Dot stars -->
<circle cx="310" cy="55" r="3.5" fill="black"/>
<circle cx="368" cy="270" r="3" fill="black"/>
<circle cx="18" cy="135" r="3" fill="black"/>
<!-- Shooting star -->
<circle cx="348" cy="172" r="7" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M342,168 Q312,154 285,145" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M343,175 Q313,162 286,153" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Rocket (upper left) -->
<path d="M88,118 Q94,92 104,84 Q114,92 120,118 Z" fill="white" stroke="black" stroke-width="2.5" stroke-linejoin="round"/>
<rect x="90" y="116" width="28" height="22" rx="4" fill="white" stroke="black" stroke-width="2.5"/>
<circle cx="104" cy="107" r="7" fill="none" stroke="black" stroke-width="2"/>
<path d="M90,138 L82,152 L90,148 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M118,138 L126,152 L118,148 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M95,146 Q104,162 113,146" fill="none" stroke="black" stroke-width="2"/>
<!-- Planet with rings (lower right) -->
<ellipse cx="322" cy="328" rx="46" ry="38" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M264,322 Q322,300 380,322" fill="none" stroke="black" stroke-width="2.5"/>
<path d="M264,334 Q322,356 380,334" fill="none" stroke="black" stroke-width="2.5"/>
<path d="M283,312 Q322,303 361,312" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M280,325 Q322,316 364,325" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Planet face -->
<circle cx="310" cy="325" r="4" fill="black"/>
<circle cx="334" cy="325" r="4" fill="black"/>
<path d="M313,334 Q322,340 331,334" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- SUIT BODY -->
<ellipse cx="200" cy="298" rx="52" ry="58" fill="white" stroke="black" stroke-width="3"/>
<!-- Chest panel -->
<rect x="176" y="270" width="48" height="36" rx="6" fill="white" stroke="black" stroke-width="2"/>
<circle cx="188" cy="281" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="200" cy="281" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="212" cy="281" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<rect x="181" y="293" width="38" height="7" rx="3" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Left arm -->
<ellipse cx="144" cy="288" rx="20" ry="28" fill="white" stroke="black" stroke-width="2.5" transform="rotate(-15 144 288)"/>
<ellipse cx="133" cy="316" rx="17" ry="12" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Right arm -->
<ellipse cx="256" cy="288" rx="20" ry="28" fill="white" stroke="black" stroke-width="2.5" transform="rotate(15 256 288)"/>
<ellipse cx="267" cy="316" rx="17" ry="12" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Boots -->
<ellipse cx="180" cy="352" rx="24" ry="14" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="220" cy="352" rx="24" ry="14" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Tail (curling up right side) -->
<path d="M248,335 Q278,315 274,288 Q270,265 252,272" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<!-- HELMET -->
<circle cx="200" cy="186" r="78" fill="white" stroke="black" stroke-width="3.5"/>
<circle cx="200" cy="186" r="60" fill="white" stroke="black" stroke-width="2"/>
<!-- Helmet shine -->
<path d="M152,154 Q162,140 176,146" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Neck connector -->
<rect x="178" y="258" width="44" height="14" rx="5" fill="white" stroke="black" stroke-width="2.5"/>
<!-- CAT FACE inside helmet -->
<!-- Ears -->
<path d="M158,148 L150,127 L174,146 Z" fill="white" stroke="black" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M242,148 L250,127 L226,146 Z" fill="white" stroke="black" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M160,147 L155,132 L169,145" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M240,147 L245,132 L231,145" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Head -->
<circle cx="200" cy="185" r="48" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Eyes -->
<circle cx="184" cy="177" r="9" fill="white" stroke="black" stroke-width="2"/>
<circle cx="216" cy="177" r="9" fill="white" stroke="black" stroke-width="2"/>
<circle cx="186" cy="176" r="5" fill="black"/>
<circle cx="218" cy="176" r="5" fill="black"/>
<circle cx="188" cy="174" r="1.8" fill="white"/>
<circle cx="220" cy="174" r="1.8" fill="white"/>
<!-- Nose -->
<path d="M196,192 L200,196 L204,192 Q200,187 196,192 Z" fill="none" stroke="black" stroke-width="2"/>
<!-- Smile -->
<path d="M192,200 Q200,208 208,200" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Cheek circles -->
<circle cx="173" cy="192" r="9" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<circle cx="227" cy="192" r="9" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<!-- Whiskers -->
<line x1="157" y1="189" x2="179" y2="191" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<line x1="157" y1="196" x2="179" y2="196" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<line x1="221" y1="191" x2="243" y2="189" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<line x1="221" y1="196" x2="243" y2="196" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
  },

  {
    id: 'mushroom_pals',
    name: 'Mushroom Pals',
    category: 'nature',
    duration: 'easy',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<rect width="400" height="400" fill="white"/>
<!-- Ground -->
<path d="M10,340 Q100,328 200,335 Q300,342 390,330" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<!-- Grass tufts -->
<path d="M30,336 Q33,325 36,336" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M50,338 Q54,324 58,338" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M160,338 Q164,325 168,338" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M240,337 Q244,324 248,337" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M340,336 Q344,323 348,336" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M365,334 Q369,321 373,334" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Small pebbles -->
<ellipse cx="90" cy="342" rx="8" ry="5" fill="white" stroke="black" stroke-width="1.5"/>
<ellipse cx="310" cy="341" rx="6" ry="4" fill="white" stroke="black" stroke-width="1.5"/>
<ellipse cx="195" cy="343" rx="5" ry="3.5" fill="white" stroke="black" stroke-width="1.5"/>
<!-- Clover/small flowers on ground -->
<circle cx="130" cy="342" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<line x1="130" y1="346" x2="130" y2="353" stroke="black" stroke-width="1.5"/>
<circle cx="280" cy="341" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<line x1="280" y1="345" x2="280" y2="352" stroke="black" stroke-width="1.5"/>
<!-- Falling leaves -->
<path d="M62,90 Q74,82 78,95 Q66,103 62,90 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="70" y1="88" x2="67" y2="102" stroke="black" stroke-width="1.5"/>
<path d="M320,130 Q332,122 336,135 Q324,143 320,130 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="328" y1="128" x2="325" y2="142" stroke="black" stroke-width="1.5"/>
<path d="M355,200 Q367,192 371,205 Q359,213 355,200 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="363" y1="198" x2="360" y2="212" stroke="black" stroke-width="1.5"/>
<!-- Small decorative flowers -->
<circle cx="28" cy="300" r="5" fill="none" stroke="black" stroke-width="2"/>
<circle cx="18" cy="293" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="26" cy="290" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="35" cy="291" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="38" cy="300" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<line x1="28" y1="305" x2="28" y2="318" stroke="black" stroke-width="2"/>
<circle cx="372" cy="295" r="5" fill="none" stroke="black" stroke-width="2"/>
<circle cx="362" cy="288" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="370" cy="285" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="380" cy="286" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="383" cy="295" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<line x1="372" y1="300" x2="372" y2="313" stroke="black" stroke-width="2"/>

<!-- LEFT MUSHROOM (medium, slightly leaning) -->
<!-- Stem -->
<path d="M110,340 Q106,295 108,275 Q114,264 122,265 Q130,264 134,278 Q136,298 132,340 Z" fill="white" stroke="black" stroke-width="3"/>
<!-- Stem lines -->
<path d="M113,310 Q121,305 131,310" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M111,290 Q120,285 132,290" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Cap -->
<path d="M78,278 Q80,235 121,218 Q162,235 164,278 Q144,292 121,292 Q98,292 78,278 Z" fill="white" stroke="black" stroke-width="3"/>
<!-- Polka dots on cap -->
<circle cx="105" cy="248" r="9" fill="none" stroke="black" stroke-width="2"/>
<circle cx="135" cy="244" r="7" fill="none" stroke="black" stroke-width="2"/>
<circle cx="121" cy="265" r="8" fill="none" stroke="black" stroke-width="2"/>
<circle cx="95" cy="268" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="147" cy="262" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Cap underside ribs -->
<path d="M82,278 Q99,285 121,286 Q143,285 160,278" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Face on stem -->
<circle cx="116" cy="302" r="4.5" fill="black"/>
<circle cx="128" cy="302" r="4.5" fill="black"/>
<circle cx="118" cy="300" r="1.5" fill="white"/>
<circle cx="130" cy="300" r="1.5" fill="white"/>
<path d="M114,311 Q122,317 130,311" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<circle cx="110" cy="308" r="5" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,2"/>
<circle cx="132" cy="308" r="5" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,2"/>

<!-- CENTER MUSHROOM (tallest, main character) -->
<!-- Stem -->
<path d="M172,340 Q168,285 170,258 Q178,244 200,244 Q222,244 230,258 Q232,285 228,340 Z" fill="white" stroke="black" stroke-width="3"/>
<path d="M176,305 Q200,298 224,305" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M174,278 Q200,270 226,278" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Cap -->
<path d="M135,260 Q136,202 200,180 Q264,202 265,260 Q240,278 200,280 Q160,278 135,260 Z" fill="white" stroke="black" stroke-width="3"/>
<!-- Polka dots -->
<circle cx="172" cy="220" r="11" fill="none" stroke="black" stroke-width="2.5"/>
<circle cx="200" cy="210" r="9" fill="none" stroke="black" stroke-width="2.5"/>
<circle cx="228" cy="220" r="11" fill="none" stroke="black" stroke-width="2.5"/>
<circle cx="186" cy="242" r="9" fill="none" stroke="black" stroke-width="2"/>
<circle cx="214" cy="242" r="9" fill="none" stroke="black" stroke-width="2"/>
<circle cx="200" cy="258" r="7" fill="none" stroke="black" stroke-width="2"/>
<!-- Cap underside -->
<path d="M138,260 Q165,272 200,274 Q235,272 262,260" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Face -->
<circle cx="192" cy="296" r="5.5" fill="black"/>
<circle cx="208" cy="296" r="5.5" fill="black"/>
<circle cx="194" cy="294" r="2" fill="white"/>
<circle cx="210" cy="294" r="2" fill="white"/>
<path d="M188,308 Q200,316 212,308" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="183" cy="305" r="7" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<circle cx="217" cy="305" r="7" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>

<!-- RIGHT MUSHROOM (smaller, round cap) -->
<!-- Stem -->
<path d="M272,340 Q270,308 272,294 Q278,285 286,285 Q294,285 298,295 Q300,308 298,340 Z" fill="white" stroke="black" stroke-width="3"/>
<path d="M274,318 Q285,313 297,318" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Cap (round amanita style) -->
<path d="M252,298 Q254,265 285,254 Q316,265 318,298 Q304,307 285,308 Q266,307 252,298 Z" fill="white" stroke="black" stroke-width="3"/>
<circle cx="274" cy="274" r="8" fill="none" stroke="black" stroke-width="2"/>
<circle cx="296" cy="270" r="7" fill="none" stroke="black" stroke-width="2"/>
<circle cx="285" cy="289" r="7" fill="none" stroke="black" stroke-width="2"/>
<circle cx="264" cy="286" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="306" cy="282" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Cap underside -->
<path d="M255,298 Q270,305 285,306 Q300,305 315,298" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Small face -->
<circle cx="281" cy="322" r="4" fill="black"/>
<circle cx="291" cy="322" r="4" fill="black"/>
<circle cx="282" cy="320" r="1.5" fill="white"/>
<circle cx="292" cy="320" r="1.5" fill="white"/>
<path d="M279,330 Q286,335 293,330" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>

<!-- Tiny mushroom baby (far left) -->
<ellipse cx="55" cy="340" rx="8" ry="5" fill="white" stroke="black" stroke-width="2"/>
<rect x="51" y="330" width="8" height="12" rx="3" fill="white" stroke="black" stroke-width="2"/>
<circle cx="54" cy="333" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="58" cy="331" r="1.5" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Tiny mushroom right -->
<ellipse cx="348" cy="339" rx="9" ry="6" fill="white" stroke="black" stroke-width="2"/>
<rect x="344" y="328" width="8" height="13" rx="3" fill="white" stroke="black" stroke-width="2"/>
<circle cx="347" cy="332" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="351" cy="330" r="1.5" fill="none" stroke="black" stroke-width="1.5"/>

<!-- Decorative leaves at top -->
<path d="M25,55 Q50,30 75,55 Q50,60 25,55 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="50" y1="30" x2="50" y2="55" stroke="black" stroke-width="1.5"/>
<path d="M330,45 Q355,20 380,45 Q355,50 330,45 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="355" y1="20" x2="355" y2="45" stroke="black" stroke-width="1.5"/>
<!-- Small round berries/circles on stems -->
<circle cx="20" cy="28" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="28" cy="20" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="350" cy="18" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="360" cy="12" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Wavy top ground vines -->
<path d="M10,90 Q40,75 70,90 Q100,105 130,90 Q160,75 190,90" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M210,80 Q240,65 270,80 Q300,95 330,80 Q360,65 390,80" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
  },

  {
    id: 'cozy_ghosts',
    name: 'Cozy Ghosts',
    category: 'fantasy',
    duration: 'easy',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<rect width="400" height="400" fill="white"/>
<!-- Stars scattered -->
<path d="M42,38 L45,48 L55,48 L47,54 L50,64 L42,58 L34,64 L37,54 L29,48 L39,48 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M340,52 L343,62 L353,62 L345,68 L348,78 L340,72 L332,78 L335,68 L327,62 L337,62 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M370,165 L372,171 L378,171 L373,175 L375,181 L370,178 L365,181 L367,175 L362,171 L368,171 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M22,175 L24,181 L30,181 L25,185 L27,191 L22,188 L17,191 L19,185 L14,181 L20,181 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<!-- Dot stars -->
<circle cx="310" cy="38" r="3" fill="black"/>
<circle cx="80" cy="28" r="3" fill="black"/>
<circle cx="380" cy="105" r="3" fill="black"/>
<circle cx="15" cy="280" r="3" fill="black"/>
<circle cx="385" cy="310" r="3" fill="black"/>
<!-- Cross stars -->
<g stroke="black" stroke-width="2" stroke-linecap="round">
  <line x1="185" y1="30" x2="185" y2="42"/><line x1="179" y1="36" x2="191" y2="36"/>
  <line x1="380" y1="230" x2="380" y2="242"/><line x1="374" y1="236" x2="386" y2="236"/>
  <line x1="20" y1="80" x2="20" y2="92"/><line x1="14" y1="86" x2="26" y2="86"/>
</g>
<!-- Moon (top center) -->
<path d="M200,15 Q230,25 240,50 Q230,75 200,70 Q195,50 200,15 Z" fill="white" stroke="black" stroke-width="2.5"/>
<circle cx="215" cy="38" r="4" fill="black"/>
<circle cx="220" cy="52" r="3" fill="black"/>
<circle cx="210" cy="55" r="2.5" fill="black"/>
<!-- Bats -->
<path d="M80,95 Q70,85 60,88 Q65,95 70,92 Q75,98 80,95 Q85,98 90,92 Q95,95 100,88 Q90,85 80,95 Z" fill="white" stroke="black" stroke-width="2"/>
<circle cx="80" cy="92" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="78" cy="91" r="1.5" fill="black"/>
<circle cx="82" cy="91" r="1.5" fill="black"/>
<path d="M310,75 Q300,65 290,68 Q295,75 300,72 Q305,78 310,75 Q315,78 320,72 Q325,75 330,68 Q320,65 310,75 Z" fill="white" stroke="black" stroke-width="2"/>
<circle cx="310" cy="72" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="308" cy="71" r="1.5" fill="black"/>
<circle cx="312" cy="71" r="1.5" fill="black"/>
<!-- Cobweb (top right corner) -->
<line x1="360" y1="10" x2="395" y2="35" stroke="black" stroke-width="1.5"/>
<line x1="365" y1="10" x2="395" y2="45" stroke="black" stroke-width="1.5"/>
<line x1="370" y1="10" x2="395" y2="55" stroke="black" stroke-width="1.5"/>
<path d="M366,16 Q380,20 392,30" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M364,22 Q378,28 392,40" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="380" cy="26" r="2.5" fill="black"/>
<!-- Autumn leaves -->
<path d="M40,200 Q52,190 58,202 Q46,212 40,200 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="49" y1="190" x2="46" y2="210" stroke="black" stroke-width="1.5"/>
<path d="M350,240 Q362,230 368,242 Q356,252 350,240 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="359" y1="230" x2="356" y2="250" stroke="black" stroke-width="1.5"/>
<path d="M18,340 Q30,330 36,342 Q24,352 18,340 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="27" y1="330" x2="24" y2="348" stroke="black" stroke-width="1.5"/>
<!-- Pumpkin (bottom left) -->
<ellipse cx="85" cy="340" rx="30" ry="26" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="85" cy="340" rx="20" ry="26" fill="none" stroke="black" stroke-width="1.5"/>
<ellipse cx="85" cy="340" rx="10" ry="26" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Pumpkin face -->
<path d="M71,332 L68,338 L74,338 Z" fill="none" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M96,332 L93,338 L99,338 Z" fill="none" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M74,346 Q85,354 96,346" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<line x1="80" y1="346" x2="80" y2="354" stroke="black" stroke-width="1.5"/>
<line x1="85" y1="348" x2="85" y2="354" stroke="black" stroke-width="1.5"/>
<line x1="90" y1="346" x2="90" y2="354" stroke="black" stroke-width="1.5"/>
<!-- Pumpkin stem -->
<path d="M85,314 Q88,308 92,304 Q94,310 88,314" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Small pumpkin right -->
<ellipse cx="335" cy="355" rx="22" ry="18" fill="white" stroke="black" stroke-width="2"/>
<ellipse cx="335" cy="355" rx="15" ry="18" fill="none" stroke="black" stroke-width="1.5"/>
<ellipse cx="335" cy="355" rx="7" ry="18" fill="none" stroke="black" stroke-width="1"/>
<circle cx="328" cy="350" r="3.5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="342" cy="350" r="3.5" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M328,360 Q335,365 342,360" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M335,337 Q338,331 342,327 Q344,333 337,337" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>

<!-- LEFT GHOST (larger) -->
<path d="M130,320 Q120,265 122,225 Q126,175 170,155 Q214,155 218,225 Q220,265 210,320 Q205,330 200,320 Q195,310 190,320 Q185,330 180,320 Q175,310 170,320 Q165,330 160,320 Q155,310 148,320 Q143,330 136,320 Q133,325 130,320 Z" fill="white" stroke="black" stroke-width="3"/>
<!-- Ghost eyes -->
<ellipse cx="156" cy="240" rx="13" ry="16" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="184" cy="240" rx="13" ry="16" fill="white" stroke="black" stroke-width="2.5"/>
<circle cx="158" cy="242" r="7" fill="black"/>
<circle cx="186" cy="242" r="7" fill="black"/>
<circle cx="161" cy="239" r="2.5" fill="white"/>
<circle cx="189" cy="239" r="2.5" fill="white"/>
<!-- Ghost mouth -->
<path d="M153,265 Q170,278 187,265" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Ghost blush -->
<circle cx="143" cy="258" r="8" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<circle cx="197" cy="258" r="8" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<!-- Ghost scarf -->
<path d="M124,200 Q170,215 218,200" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<path d="M124,208 Q170,222 218,208" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Scarf stripes (small rectangles look) -->
<line x1="135" y1="201" x2="135" y2="210" stroke="black" stroke-width="1.5"/>
<line x1="147" y1="204" x2="147" y2="213" stroke="black" stroke-width="1.5"/>
<line x1="159" y1="207" x2="159" y2="216" stroke="black" stroke-width="1.5"/>
<line x1="171" y1="208" x2="171" y2="217" stroke="black" stroke-width="1.5"/>
<line x1="183" y1="207" x2="183" y2="216" stroke="black" stroke-width="1.5"/>
<line x1="195" y1="205" x2="195" y2="214" stroke="black" stroke-width="1.5"/>
<line x1="207" y1="202" x2="207" y2="211" stroke="black" stroke-width="1.5"/>

<!-- RIGHT GHOST (smaller, holding book) -->
<path d="M258,335 Q248,290 250,255 Q254,214 284,198 Q314,214 318,255 Q320,290 310,335 Q307,343 303,335 Q299,327 295,335 Q291,343 287,335 Q283,327 280,335 Q276,343 272,335 Q268,327 264,335 Q261,341 258,335 Z" fill="white" stroke="black" stroke-width="3"/>
<!-- Ghost eyes -->
<ellipse cx="275" cy="264" rx="11" ry="13" fill="white" stroke="black" stroke-width="2"/>
<ellipse cx="298" cy="264" rx="11" ry="13" fill="white" stroke="black" stroke-width="2"/>
<circle cx="277" cy="266" r="6" fill="black"/>
<circle cx="300" cy="266" r="6" fill="black"/>
<circle cx="279" cy="263" r="2" fill="white"/>
<circle cx="302" cy="263" r="2" fill="white"/>
<!-- Ghost smile (happy/excited) -->
<path d="M272,282 Q284,292 298,282" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Blush -->
<circle cx="264" cy="277" r="7" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<circle cx="307" cy="277" r="7" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<!-- Book the ghost holds -->
<rect x="256" y="305" width="60" height="44" rx="4" fill="white" stroke="black" stroke-width="2.5"/>
<line x1="286" y1="305" x2="286" y2="349" stroke="black" stroke-width="2"/>
<!-- Book lines (pages) -->
<line x1="262" y1="315" x2="284" y2="315" stroke="black" stroke-width="1.5"/>
<line x1="262" y1="322" x2="284" y2="322" stroke="black" stroke-width="1.5"/>
<line x1="262" y1="329" x2="284" y2="329" stroke="black" stroke-width="1.5"/>
<line x1="262" y1="336" x2="284" y2="336" stroke="black" stroke-width="1.5"/>
<line x1="262" y1="343" x2="284" y2="343" stroke="black" stroke-width="1.5"/>
<!-- Book cover design -->
<circle cx="310" cy="320" r="8" fill="none" stroke="black" stroke-width="2"/>
<circle cx="310" cy="320" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<line x1="310" y1="308" x2="310" y2="332" stroke="black" stroke-width="1.5"/>
<line x1="298" y1="320" x2="322" y2="320" stroke="black" stroke-width="1.5"/>
</svg>`,
  },

  // ── MEDIUM ────────────────────────────────────────────────────────────────

  {
    id: 'ocean_buddies',
    name: 'Ocean Buddies',
    category: 'scenes',
    duration: 'medium',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<rect width="400" height="400" fill="white"/>
<!-- Water surface waves at top -->
<path d="M0,55 Q25,38 50,55 Q75,72 100,55 Q125,38 150,55 Q175,72 200,55 Q225,38 250,55 Q275,72 300,55 Q325,38 350,55 Q375,72 400,55" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M0,68 Q20,55 40,68 Q60,81 80,68 Q100,55 120,68 Q140,81 160,68 Q180,55 200,68" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Bubbles -->
<circle cx="45" cy="120" r="6" fill="none" stroke="black" stroke-width="2"/>
<circle cx="38" cy="105" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="52" cy="90" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="355" cy="130" r="5" fill="none" stroke="black" stroke-width="2"/>
<circle cx="362" cy="115" r="7" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="348" cy="100" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="170" cy="80" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="175" cy="68" r="3.5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="300" cy="360" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="308" cy="348" r="3.5" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Seaweed left -->
<path d="M30,400 Q20,380 30,360 Q40,340 28,320 Q16,300 28,275 Q40,250 28,230" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<path d="M28,340 Q8,330 12,318" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M30,300 Q50,290 46,278" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M28,260 Q8,250 12,238" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Seaweed right -->
<path d="M375,400 Q385,375 374,352 Q363,329 376,306 Q389,283 374,260 Q359,237 374,215" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<path d="M374,350 Q394,340 390,328" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M375,308 Q355,298 359,286" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Coral formations -->
<path d="M60,400 Q55,375 60,360 M60,360 Q50,350 45,340 M60,360 Q70,348 72,336 M60,360 Q55,342 52,330 M60,360 Q66,345 70,332" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<path d="M330,400 Q335,375 330,360 M330,360 Q320,350 318,338 M330,360 Q340,346 342,332 M330,360 Q325,342 322,328 M330,360 Q336,343 340,330" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<!-- Starfish -->
<path d="M80,370 L82,358 L84,370 L90,364 L84,374 L80,370 Z" fill="white" stroke="black" stroke-width="2"/>
<circle cx="83" cy="368" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M348,375 L350,363 L352,375 L358,369 L352,379 L348,375 Z" fill="white" stroke="black" stroke-width="2"/>
<circle cx="351" cy="373" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Small crab (bottom center) -->
<ellipse cx="200" cy="385" rx="22" ry="14" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Crab eyes on stalks -->
<line x1="190" y1="371" x2="186" y2="364" stroke="black" stroke-width="2"/>
<circle cx="186" cy="362" r="4" fill="white" stroke="black" stroke-width="2"/>
<circle cx="187" cy="362" r="2" fill="black"/>
<line x1="210" y1="371" x2="214" y2="364" stroke="black" stroke-width="2"/>
<circle cx="214" cy="362" r="4" fill="white" stroke="black" stroke-width="2"/>
<circle cx="215" cy="362" r="2" fill="black"/>
<!-- Crab claws -->
<path d="M180,380 Q168,374 165,368 Q162,362 168,360 Q174,362 175,370" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M165,360 Q160,354 165,350 Q170,352 170,360" fill="none" stroke="black" stroke-width="2"/>
<path d="M220,380 Q232,374 235,368 Q238,362 232,360 Q226,362 225,370" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M235,360 Q240,354 235,350 Q230,352 230,360" fill="none" stroke="black" stroke-width="2"/>
<!-- Crab smile -->
<path d="M190,386 Q200,392 210,386" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>

<!-- MAIN WHALE (center-left area) -->
<path d="M80,200 Q75,155 100,135 Q140,110 190,120 Q235,130 250,165 Q260,190 255,220 Q250,255 230,270 Q200,285 165,280 Q120,272 95,248 Q75,228 80,200 Z" fill="white" stroke="black" stroke-width="3"/>
<!-- Whale belly line -->
<path d="M95,240 Q165,265 240,238" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Whale tail -->
<path d="M80,200 Q55,210 48,195 Q42,175 62,168 Q72,178 80,190" fill="white" stroke="black" stroke-width="3"/>
<path d="M80,200 Q52,205 45,222 Q40,238 58,240 Q70,232 80,218" fill="white" stroke="black" stroke-width="3"/>
<!-- Whale fin (top) -->
<path d="M165,118 Q170,88 185,78 Q192,95 185,118" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Side flipper -->
<path d="M130,230 Q112,248 108,262 Q118,265 135,250 Q148,240 148,230" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Blowhole spout -->
<path d="M155,118 Q152,100 148,85 Q145,78 150,75" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M150,75 Q148,65 152,60 Q156,65 155,72" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M152,68 Q148,58 152,52 Q157,58 155,65" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Whale eyes -->
<circle cx="230" cy="175" r="14" fill="white" stroke="black" stroke-width="2.5"/>
<circle cx="233" cy="175" r="8" fill="black"/>
<circle cx="235" cy="172" r="3" fill="white"/>
<!-- Whale smile -->
<path d="M218,198 Q230,210 242,202" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Whale belly spots (decoration) -->
<ellipse cx="140" cy="245" rx="12" ry="8" fill="none" stroke="black" stroke-width="1.5"/>
<ellipse cx="168" cy="252" rx="10" ry="6" fill="none" stroke="black" stroke-width="1.5"/>
<ellipse cx="196" cy="248" rx="9" ry="6" fill="none" stroke="black" stroke-width="1.5"/>

<!-- SMALL FISH (top right) -->
<!-- Fish 1 - round cute -->
<ellipse cx="300" cy="140" rx="28" ry="20" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M328,140 L342,128 L342,152 Z" fill="white" stroke="black" stroke-width="2.5"/>
<circle cx="285" cy="136" r="8" fill="white" stroke="black" stroke-width="2"/>
<circle cx="286" cy="135" r="4" fill="black"/>
<circle cx="287" cy="134" r="1.5" fill="white"/>
<path d="M288,145 Q296,150 304,145" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M300,122 Q310,115 318,122" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M302,158 Q311,165 320,158" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Fish stripe -->
<path d="M306,122 Q309,140 306,158" fill="none" stroke="black" stroke-width="1.5"/>

<!-- Fish 2 (smaller, upper) -->
<ellipse cx="340" cy="90" rx="18" ry="12" fill="white" stroke="black" stroke-width="2"/>
<path d="M358,90 L368,82 L368,98 Z" fill="white" stroke="black" stroke-width="2"/>
<circle cx="328" cy="87" r="6" fill="white" stroke="black" stroke-width="2"/>
<circle cx="329" cy="87" r="3" fill="black"/>
<circle cx="330" cy="86" r="1" fill="white"/>
<path d="M330,94 Q337,98 344,94" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>

<!-- Jellyfish (right side) -->
<path d="M310,230 Q290,215 295,235 Q300,215 310,230 Q320,215 325,235 Q330,215 310,230 Z" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Jelly dome -->
<path d="M292,232 Q310,240 328,232 Q318,215 310,212 Q302,215 292,232 Z" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Jelly face -->
<circle cx="305" cy="224" r="3" fill="black"/>
<circle cx="315" cy="224" r="3" fill="black"/>
<path d="M305,230 Q310,234 315,230" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Tentacles -->
<path d="M296,232 Q292,248 296,264 Q300,280 294,295" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M303,234 Q300,250 303,266 Q306,282 300,297" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M310,235 Q310,252 310,268 Q310,284 306,298" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M317,234 Q320,250 317,266 Q314,282 320,297" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M324,232 Q328,248 324,264 Q320,280 326,295" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
  },

  {
    id: 'dreamy_night',
    name: 'Dreamy Night',
    category: 'fantasy',
    duration: 'medium',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<rect width="400" height="400" fill="white"/>
<!-- Stars of various sizes -->
<path d="M30,40 L33,50 L43,50 L35,56 L38,66 L30,60 L22,66 L25,56 L17,50 L27,50 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M360,30 L363,40 L373,40 L365,46 L368,56 L360,50 L352,56 L355,46 L347,40 L357,40 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M340,145 L342,151 L348,151 L343,155 L345,161 L340,158 L335,161 L337,155 L332,151 L338,151 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M50,210 L52,216 L58,216 L53,220 L55,226 L50,223 L45,226 L47,220 L42,216 L48,216 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<!-- Dot stars -->
<circle cx="100" cy="25" r="3.5" fill="black"/>
<circle cx="280" cy="18" r="3" fill="black"/>
<circle cx="380" cy="85" r="2.5" fill="black"/>
<circle cx="10" cy="140" r="2.5" fill="black"/>
<circle cx="380" cy="195" r="3" fill="black"/>
<circle cx="200" cy="32" r="3" fill="black"/>
<!-- Crescent MOON (upper center-right, large) -->
<path d="M280,25 Q340,45 345,95 Q350,145 310,170 Q340,145 338,95 Q336,50 290,32 Z" fill="white" stroke="black" stroke-width="3"/>
<!-- Moon face -->
<circle cx="310" cy="100" r="5" fill="black"/>
<circle cx="326" cy="108" r="5" fill="black"/>
<path d="M308,118 Q318,126 328,120" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Moon craters -->
<circle cx="298" cy="130" r="9" fill="none" stroke="black" stroke-width="2"/>
<circle cx="318" cy="148" r="7" fill="none" stroke="black" stroke-width="1.5"/>

<!-- Rolling hills at bottom -->
<path d="M0,360 Q80,320 160,360 Q240,400 320,355 Q370,330 400,360 L400,400 L0,400 Z" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M0,380 Q60,360 120,380 Q180,400 240,375 Q300,350 360,375 Q390,385 400,380" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Tiny castle silhouette on hill (center bottom) -->
<rect x="175" y="322" width="50" height="38" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="170" y="312" width="16" height="18" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="214" y="312" width="16" height="18" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Battlements -->
<rect x="170" y="306" width="5" height="8" fill="white" stroke="black" stroke-width="2"/>
<rect x="178" y="306" width="5" height="8" fill="white" stroke="black" stroke-width="2"/>
<rect x="214" y="306" width="5" height="8" fill="white" stroke="black" stroke-width="2"/>
<rect x="222" y="306" width="5" height="8" fill="white" stroke="black" stroke-width="2"/>
<!-- Castle door -->
<path d="M192,360 Q192,344 200,340 Q208,344 208,360 Z" fill="none" stroke="black" stroke-width="2"/>
<!-- Castle window -->
<circle cx="200" cy="335" r="6" fill="none" stroke="black" stroke-width="2"/>
<!-- Trees beside castle -->
<line x1="155" y1="360" x2="155" y2="338" stroke="black" stroke-width="2.5"/>
<path d="M138,348 Q155,328 172,348 Q155,344 138,348 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M142,338 Q155,318 168,338 Q155,334 142,338 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="245" y1="360" x2="245" y2="338" stroke="black" stroke-width="2.5"/>
<path d="M228,348 Q245,328 262,348 Q245,344 228,348 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M232,338 Q245,318 258,338 Q245,334 232,338 Z" fill="white" stroke="black" stroke-width="2"/>

<!-- BIG CLOUD 1 (center-left, with face) -->
<ellipse cx="110" cy="145" rx="72" ry="48" fill="white" stroke="black" stroke-width="3"/>
<ellipse cx="68" cy="155" rx="40" ry="32" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="150" cy="152" rx="42" ry="33" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="110" cy="168" rx="55" ry="28" fill="white" stroke="black" stroke-width="2"/>
<!-- Cloud face -->
<ellipse cx="96" cy="148" rx="10" ry="12" fill="white" stroke="black" stroke-width="2"/>
<ellipse cx="124" cy="148" rx="10" ry="12" fill="white" stroke="black" stroke-width="2"/>
<circle cx="98" cy="150" r="5.5" fill="black"/>
<circle cx="126" cy="150" r="5.5" fill="black"/>
<circle cx="100" cy="148" r="2" fill="white"/>
<circle cx="128" cy="148" r="2" fill="white"/>
<path d="M93,163 Q110,172 127,163" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Cloud blush -->
<circle cx="82" cy="162" r="8" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<circle cx="138" cy="162" r="8" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<!-- Zzz from cloud (sleeping look) -->
<text x="148" y="125" font-size="22" font-weight="bold" font-family="serif" fill="none" stroke="black" stroke-width="1.5">z</text>
<text x="160" y="112" font-size="18" font-weight="bold" font-family="serif" fill="none" stroke="black" stroke-width="1.5">z</text>
<text x="170" y="102" font-size="14" font-weight="bold" font-family="serif" fill="none" stroke="black" stroke-width="1.5">z</text>

<!-- MEDIUM CLOUD 2 (right, awake and happy) -->
<ellipse cx="290" cy="235" rx="60" ry="40" fill="white" stroke="black" stroke-width="3"/>
<ellipse cx="252" cy="243" rx="34" ry="26" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="326" cy="241" rx="36" ry="27" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="290" cy="256" rx="46" ry="22" fill="white" stroke="black" stroke-width="2"/>
<!-- Cloud 2 face -->
<ellipse cx="278" cy="236" rx="9" ry="11" fill="white" stroke="black" stroke-width="2"/>
<ellipse cx="302" cy="236" rx="9" ry="11" fill="white" stroke="black" stroke-width="2"/>
<circle cx="280" cy="238" r="5" fill="black"/>
<circle cx="304" cy="238" r="5" fill="black"/>
<circle cx="282" cy="236" r="1.8" fill="white"/>
<circle cx="306" cy="236" r="1.8" fill="white"/>
<path d="M276,250 Q290,260 304,250" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="264" cy="248" r="7" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<circle cx="316" cy="248" r="7" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<!-- Stars hanging from cloud 2 (cute mobile) -->
<line x1="260" y1="275" x2="256" y2="295" stroke="black" stroke-width="1.5"/>
<path d="M252,295 L254,302 L261,302 L256,307 L258,314 L252,310 L246,314 L248,307 L243,302 L250,302 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<line x1="290" y1="278" x2="290" y2="298" stroke="black" stroke-width="1.5"/>
<circle cx="290" cy="304" r="7" fill="white" stroke="black" stroke-width="1.5"/>
<circle cx="290" cy="304" r="3" fill="none" stroke="black" stroke-width="1"/>
<line x1="320" y1="275" x2="324" y2="295" stroke="black" stroke-width="1.5"/>
<path d="M320,295 L322,302 L329,302 L324,307 L326,314 L320,310 L314,314 L316,307 L311,302 L318,302 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>

<!-- SMALL CLOUD 3 (upper left, tiny) -->
<ellipse cx="62" cy="275" rx="38" ry="26" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="36" cy="281" rx="22" ry="18" fill="white" stroke="black" stroke-width="2"/>
<ellipse cx="84" cy="280" rx="24" ry="18" fill="white" stroke="black" stroke-width="2"/>
<!-- Small face -->
<circle cx="54" cy="274" r="5" fill="white" stroke="black" stroke-width="1.5"/>
<circle cx="70" cy="274" r="5" fill="white" stroke="black" stroke-width="1.5"/>
<circle cx="55" cy="275" r="2.5" fill="black"/>
<circle cx="71" cy="275" r="2.5" fill="black"/>
<path d="M53,282 Q62,287 71,282" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>

<!-- Rainbow arcing through scene -->
<path d="M18,320 Q80,180 200,152 Q320,180 382,320" fill="none" stroke="black" stroke-width="2.5"/>
<path d="M30,320 Q88,192 200,167 Q312,192 370,320" fill="none" stroke="black" stroke-width="2"/>
<path d="M42,320 Q96,202 200,182 Q304,202 358,320" fill="none" stroke="black" stroke-width="2"/>
<path d="M54,320 Q104,214 200,197 Q296,214 346,320" fill="none" stroke="black" stroke-width="1.5"/>
</svg>`,
  },

  {
    id: 'forest_hollow',
    name: 'Forest Hollow',
    category: 'nature',
    duration: 'medium',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<rect width="400" height="400" fill="white"/>
<!-- Ground / grass -->
<path d="M0,370 Q100,355 200,365 Q300,375 400,360 L400,400 L0,400 Z" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Grass tufts -->
<path d="M20,368 Q23,357 26,368" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M40,370 Q44,356 48,370" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M355,362 Q359,348 363,362" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M375,365 Q379,351 383,365" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M155,368 Q159,354 163,368" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M240,371 Q244,357 248,371" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Falling leaves -->
<path d="M30,120 Q42,112 46,125 Q34,133 30,120 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="38" y1="112" x2="35" y2="128" stroke="black" stroke-width="1.5"/>
<path d="M350,160 Q362,152 366,165 Q354,173 350,160 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="358" y1="152" x2="355" y2="168" stroke="black" stroke-width="1.5"/>
<path d="M380,250 Q392,242 396,255 Q384,263 380,250 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="388" y1="242" x2="385" y2="258" stroke="black" stroke-width="1.5"/>
<path d="M8,300 Q20,292 24,305 Q12,313 8,300 Z" fill="white" stroke="black" stroke-width="2"/>
<line x1="16" y1="292" x2="13" y2="308" stroke="black" stroke-width="1.5"/>
<!-- Background trees (smaller) -->
<!-- Left background tree -->
<rect x="28" y="200" width="22" height="175" rx="4" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="39" cy="200" rx="42" ry="55" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="39" cy="170" rx="34" ry="44" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Right background tree -->
<rect x="352" y="220" width="22" height="155" rx="4" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="363" cy="220" rx="40" ry="52" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="363" cy="190" rx="32" ry="42" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Small mushrooms beside tree -->
<ellipse cx="55" cy="370" rx="16" ry="10" fill="white" stroke="black" stroke-width="2"/>
<rect x="50" y="360" width="10" height="12" rx="3" fill="white" stroke="black" stroke-width="2"/>
<circle cx="53" cy="363" r="2.5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="58" cy="361" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<ellipse cx="348" cy="370" rx="16" ry="10" fill="white" stroke="black" stroke-width="2"/>
<rect x="343" y="360" width="10" height="12" rx="3" fill="white" stroke="black" stroke-width="2"/>
<circle cx="346" cy="363" r="2.5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="351" cy="361" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Flowers in foreground -->
<line x1="80" y1="370" x2="80" y2="352" stroke="black" stroke-width="2"/>
<circle cx="80" cy="346" r="8" fill="white" stroke="black" stroke-width="2"/>
<circle cx="72" cy="338" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="80" cy="335" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="88" cy="338" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="75" cy="348" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="85" cy="348" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<line x1="315" y1="370" x2="315" y2="352" stroke="black" stroke-width="2"/>
<circle cx="315" cy="346" r="8" fill="white" stroke="black" stroke-width="2"/>
<circle cx="307" cy="338" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="315" cy="335" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="323" cy="338" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="310" cy="348" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="320" cy="348" r="6" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Cute rabbit in grass left -->
<ellipse cx="108" cy="365" rx="16" ry="12" fill="white" stroke="black" stroke-width="2"/>
<ellipse cx="108" cy="353" rx="11" ry="14" fill="white" stroke="black" stroke-width="2"/>
<path d="M102,342 Q100,320 104,316" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M114,342 Q116,320 112,316" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<circle cx="104" cy="357" r="3" fill="black"/>
<circle cx="112" cy="357" r="3" fill="black"/>
<circle cx="105" cy="355" r="1" fill="white"/>
<circle cx="113" cy="355" r="1" fill="white"/>
<ellipse cx="108" cy="362" rx="4" ry="2.5" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M103,366 Q108,369 113,366" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Fox peeking right side -->
<ellipse cx="295" cy="367" rx="18" ry="13" fill="white" stroke="black" stroke-width="2"/>
<ellipse cx="295" cy="355" rx="13" ry="15" fill="white" stroke="black" stroke-width="2"/>
<path d="M286,346 L282,328 L290,340 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M304,346 L308,328 L300,340 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<circle cx="290" cy="359" r="3.5" fill="black"/>
<circle cx="300" cy="359" r="3.5" fill="black"/>
<circle cx="291" cy="357" r="1.2" fill="white"/>
<circle cx="301" cy="357" r="1.2" fill="white"/>
<ellipse cx="295" cy="365" rx="4" ry="3" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M281,360" fill="none"/>
<!-- MAIN BIG TREE (center) -->
<!-- Trunk -->
<path d="M168,400 Q162,340 160,290 Q158,250 162,225 Q166,210 200,208 Q234,210 238,225 Q242,250 240,290 Q238,340 232,400 Z" fill="white" stroke="black" stroke-width="3.5"/>
<!-- Trunk texture lines -->
<path d="M172,380 Q185,370 195,380" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M175,355 Q188,345 200,352" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M205,360 Q215,350 228,356" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M178,330 Q190,320 200,328" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M203,335 Q214,325 226,332" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Root bumps -->
<path d="M164,390 Q145,385 138,395" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M236,390 Q255,385 262,395" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- HOLLOW / DOOR in trunk -->
<path d="M180,280 Q180,252 200,246 Q220,252 220,280 Q220,296 200,298 Q180,296 180,280 Z" fill="white" stroke="black" stroke-width="3"/>
<!-- Hollow frame detail -->
<path d="M176,282 Q176,250 200,243 Q224,250 224,282" fill="none" stroke="black" stroke-width="1.5"/>
<!-- OWL in hollow -->
<!-- Owl body -->
<ellipse cx="200" cy="278" rx="14" ry="18" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Owl wings (tucked) -->
<path d="M186,270 Q178,278 182,290 Q188,282 186,270 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M214,270 Q222,278 218,290 Q212,282 214,270 Z" fill="white" stroke="black" stroke-width="2"/>
<!-- Owl tummy feathers -->
<path d="M192,278 Q200,285 208,278 Q200,282 192,278 Z" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M191,285 Q200,292 209,285 Q200,289 191,285 Z" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Owl head -->
<circle cx="200" cy="258" r="14" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Owl ear tufts -->
<path d="M191,248 L188,238 L194,246 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<path d="M209,248 L212,238 L206,246 Z" fill="white" stroke="black" stroke-width="2" stroke-linejoin="round"/>
<!-- Owl eye circles (large facial discs) -->
<circle cx="193" cy="258" r="7" fill="white" stroke="black" stroke-width="2"/>
<circle cx="207" cy="258" r="7" fill="white" stroke="black" stroke-width="2"/>
<circle cx="193" cy="258" r="4" fill="black"/>
<circle cx="207" cy="258" r="4" fill="black"/>
<circle cx="194" cy="256" r="1.5" fill="white"/>
<circle cx="208" cy="256" r="1.5" fill="white"/>
<!-- Owl beak -->
<path d="M197,264 L200,268 L203,264 Q200,261 197,264 Z" fill="none" stroke="black" stroke-width="2"/>
<!-- Owl feet on branch -->
<line x1="194" y1="296" x2="192" y2="305" stroke="black" stroke-width="2"/>
<line x1="200" y1="297" x2="200" y2="306" stroke="black" stroke-width="2"/>
<line x1="206" y1="296" x2="208" y2="305" stroke="black" stroke-width="2"/>
<path d="M188,306 Q196,302 200,306 Q204,302 212,306" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Main tree canopy (large, layered) -->
<path d="M100,220 Q108,145 200,110 Q292,145 300,220 Q280,240 200,246 Q120,240 100,220 Z" fill="white" stroke="black" stroke-width="3"/>
<path d="M120,190 Q128,125 200,94 Q272,125 280,190 Q260,210 200,216 Q140,210 120,190 Z" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M140,160 Q150,108 200,82 Q250,108 260,160 Q245,178 200,184 Q155,178 140,160 Z" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Canopy details (round bumps at edges) -->
<circle cx="110" cy="210" r="18" fill="white" stroke="black" stroke-width="2"/>
<circle cx="145" cy="192" r="16" fill="white" stroke="black" stroke-width="2"/>
<circle cx="255" cy="192" r="16" fill="white" stroke="black" stroke-width="2"/>
<circle cx="290" cy="210" r="18" fill="white" stroke="black" stroke-width="2"/>
<circle cx="130" cy="158" r="14" fill="white" stroke="black" stroke-width="2"/>
<circle cx="270" cy="158" r="14" fill="white" stroke="black" stroke-width="2"/>
<circle cx="165" cy="128" r="14" fill="white" stroke="black" stroke-width="2"/>
<circle cx="235" cy="128" r="14" fill="white" stroke="black" stroke-width="2"/>
<!-- Cute tree face (lower on trunk) -->
<circle cx="190" cy="235" r="3" fill="black"/>
<circle cx="210" cy="235" r="3" fill="black"/>
<path d="M187,242 Q200,248 213,242" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  },

  // ── HARD ──────────────────────────────────────────────────────────────────

  {
    id: 'cozy_cafe',
    name: 'Cozy Café',
    category: 'scenes',
    duration: 'hard',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<rect width="400" height="400" fill="white"/>
<!-- Background wall / window frame -->
<rect x="10" y="10" width="380" height="380" rx="8" fill="none" stroke="black" stroke-width="2"/>
<!-- Window (left side of scene) -->
<rect x="20" y="20" width="155" height="185" rx="6" fill="none" stroke="black" stroke-width="3"/>
<!-- Window cross bars -->
<line x1="97" y1="20" x2="97" y2="205" stroke="black" stroke-width="2.5"/>
<line x1="20" y1="112" x2="175" y2="112" stroke="black" stroke-width="2.5"/>
<!-- Window frame border -->
<rect x="24" y="24" width="147" height="183" rx="4" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Stars outside window (top panes) -->
<path d="M55,55 L57,62 L64,62 L58,67 L60,74 L55,70 L50,74 L52,67 L46,62 L53,62 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M128,42 L130,49 L137,49 L131,54 L133,61 L128,57 L123,61 L125,54 L119,49 L126,49 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="78" cy="44" r="3" fill="black"/>
<circle cx="148" cy="68" r="2.5" fill="black"/>
<circle cx="38" cy="80" r="2.5" fill="black"/>
<!-- Moon outside window -->
<path d="M70,80 Q90,85 92,100 Q90,115 70,112 Q84,100 70,80 Z" fill="white" stroke="black" stroke-width="2"/>
<!-- Flower in window (bottom pane) -->
<line x1="62" y1="200" x2="62" y2="160" stroke="black" stroke-width="2"/>
<path d="M62,165 Q70,158 74,168 Q66,175 62,165 Z" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M62,155 Q54,148 50,158 Q58,165 62,155 Z" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="62" cy="160" r="5" fill="none" stroke="black" stroke-width="2"/>
<!-- Second flower stem -->
<line x1="82" y1="200" x2="82" y2="155" stroke="black" stroke-width="2"/>
<circle cx="82" cy="149" r="7" fill="white" stroke="black" stroke-width="2"/>
<circle cx="74" cy="142" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="82" cy="139" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="90" cy="142" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="77" cy="151" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="87" cy="151" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Right window bottom: cat on sill -->
<path d="M110,195 Q108,178 112,170 Q118,162 126,162 Q134,162 138,170 Q142,178 140,195 Z" fill="white" stroke="black" stroke-width="2"/>
<!-- Cat ears -->
<path d="M114,172 L110,160 L120,170 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<path d="M136,172 L140,160 L130,170 Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
<!-- Cat face -->
<circle cx="120" cy="178" r="4" fill="white" stroke="black" stroke-width="1.5"/>
<circle cx="130" cy="178" r="4" fill="white" stroke="black" stroke-width="1.5"/>
<circle cx="121" cy="178" r="2" fill="black"/>
<circle cx="131" cy="178" r="2" fill="black"/>
<path d="M124,183 L125,185 L126,183 Q125,181 124,183 Z" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M122,187 Q125,191 128,187" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Cat tail curl -->
<path d="M140,194 Q152,186 150,175 Q148,168 142,172" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Windowsill ledge -->
<rect x="20" y="198" width="155" height="10" rx="3" fill="white" stroke="black" stroke-width="2"/>

<!-- TABLE (right half of scene, large round) -->
<ellipse cx="295" cy="310" rx="88" ry="20" fill="white" stroke="black" stroke-width="3"/>
<rect x="240" y="308" width="110" height="80" rx="5" fill="white" stroke="black" stroke-width="2"/>
<!-- Table leg -->
<rect x="282" y="328" width="26" height="52" rx="4" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M270,380 Q290,375 295,380 Q300,375 320,380" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>

<!-- MUG on table -->
<rect x="230" y="248" width="52" height="58" rx="8" fill="white" stroke="black" stroke-width="3"/>
<!-- Mug handle -->
<path d="M282,258 Q298,258 298,272 Q298,286 282,286" fill="none" stroke="black" stroke-width="2.5"/>
<!-- Steam swirls from mug -->
<path d="M244,244 Q240,232 244,220 Q248,210 244,200" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M256,244 Q252,230 256,216 Q260,204 255,192" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M268,244 Q264,232 268,220 Q272,208 267,196" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Mug design (heart) -->
<path d="M247,270 Q247,262 251,262 Q256,262 256,268 Q256,262 261,262 Q265,262 265,270 Q265,278 256,284 Q247,278 247,270 Z" fill="none" stroke="black" stroke-width="2"/>
<!-- Mug rim -->
<rect x="228" y="248" width="56" height="10" rx="6" fill="none" stroke="black" stroke-width="2"/>
<!-- Saucer -->
<ellipse cx="256" cy="310" rx="35" ry="8" fill="white" stroke="black" stroke-width="2"/>
<ellipse cx="256" cy="308" rx="24" ry="5" fill="none" stroke="black" stroke-width="1.5"/>

<!-- CAKE SLICE on table -->
<path d="M310,305 L310,260 L348,260 L348,305 Z" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Cake layers -->
<line x1="310" y1="278" x2="348" y2="278" stroke="black" stroke-width="2"/>
<line x1="310" y1="292" x2="348" y2="292" stroke="black" stroke-width="2"/>
<!-- Frosting top -->
<path d="M308,260 Q312,252 320,256 Q325,248 329,254 Q334,246 338,252 Q344,248 350,260" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
<!-- Candle on cake -->
<rect x="326" y="240" width="7" height="18" rx="2" fill="white" stroke="black" stroke-width="1.5"/>
<path d="M329,240 Q332,234 330,228 Q333,234 333,240" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Cake plate -->
<ellipse cx="329" cy="306" rx="28" ry="7" fill="white" stroke="black" stroke-width="2"/>
<!-- Decorative dots on cake layers -->
<circle cx="318" cy="284" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="329" cy="284" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="340" cy="284" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="323" cy="297" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="335" cy="297" r="2" fill="none" stroke="black" stroke-width="1.5"/>

<!-- BOOK STACK (right edge of table) -->
<rect x="355" y="282" width="30" height="10" rx="2" fill="white" stroke="black" stroke-width="2"/>
<rect x="358" y="272" width="26" height="12" rx="2" fill="white" stroke="black" stroke-width="2"/>
<rect x="356" y="260" width="28" height="14" rx="2" fill="white" stroke="black" stroke-width="2"/>
<!-- Book spine lines -->
<line x1="362" y1="282" x2="362" y2="292" stroke="black" stroke-width="1.5"/>
<line x1="362" y1="272" x2="362" y2="284" stroke="black" stroke-width="1.5"/>
<line x1="362" y1="260" x2="362" y2="274" stroke="black" stroke-width="1.5"/>
<!-- Bookmark ribbon -->
<line x1="374" y1="260" x2="374" y2="248" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M370,248 L374,242 L378,248 Z" fill="white" stroke="black" stroke-width="1.5"/>

<!-- HANGING LIGHTS string at top right area -->
<path d="M180,15 Q220,25 260,18 Q300,12 340,22 Q370,30 390,18" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Light bulbs hanging down -->
<line x1="200" y1="15" x2="200" y2="30" stroke="black" stroke-width="1.5"/>
<ellipse cx="200" cy="36" rx="7" ry="9" fill="white" stroke="black" stroke-width="1.5"/>
<line x1="196" y1="44" x2="204" y2="44" stroke="black" stroke-width="1.5"/>
<line x1="240" y1="18" x2="240" y2="33" stroke="black" stroke-width="1.5"/>
<ellipse cx="240" cy="39" rx="7" ry="9" fill="white" stroke="black" stroke-width="1.5"/>
<line x1="236" y1="47" x2="244" y2="47" stroke="black" stroke-width="1.5"/>
<line x1="280" y1="14" x2="280" y2="29" stroke="black" stroke-width="1.5"/>
<ellipse cx="280" cy="35" rx="7" ry="9" fill="white" stroke="black" stroke-width="1.5"/>
<line x1="276" y1="43" x2="284" y2="43" stroke="black" stroke-width="1.5"/>
<line x1="320" y1="20" x2="320" y2="35" stroke="black" stroke-width="1.5"/>
<ellipse cx="320" cy="41" rx="7" ry="9" fill="white" stroke="black" stroke-width="1.5"/>
<line x1="316" y1="49" x2="324" y2="49" stroke="black" stroke-width="1.5"/>
<line x1="360" y1="26" x2="360" y2="41" stroke="black" stroke-width="1.5"/>
<ellipse cx="360" cy="47" rx="7" ry="9" fill="white" stroke="black" stroke-width="1.5"/>
<line x1="356" y1="55" x2="364" y2="55" stroke="black" stroke-width="1.5"/>

<!-- POTTED PLANT (left of table area) -->
<path d="M190,350 Q184,330 190,310 Q196,290 200,280 Q204,290 210,310 Q216,330 210,350 Z" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Plant leaves -->
<path d="M200,295 Q215,280 228,285 Q220,298 200,295 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M200,308 Q218,295 232,302 Q222,315 200,308 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M200,295 Q185,280 172,285 Q180,298 200,295 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M200,308 Q182,295 168,302 Q178,315 200,308 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M200,320 Q218,308 234,316 Q222,328 200,320 Z" fill="white" stroke="black" stroke-width="2"/>
<path d="M200,320 Q182,308 166,316 Q178,328 200,320 Z" fill="white" stroke="black" stroke-width="2"/>
<!-- Pot -->
<path d="M186,350 Q184,370 192,376 Q200,380 208,376 Q216,370 214,350 Z" fill="white" stroke="black" stroke-width="2.5"/>
<ellipse cx="200" cy="350" rx="15" ry="6" fill="white" stroke="black" stroke-width="2"/>
<!-- Pot design dot pattern -->
<circle cx="196" cy="360" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="204" cy="360" r="2" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="200" cy="367" r="2" fill="none" stroke="black" stroke-width="1.5"/>

<!-- Chalkboard sign on wall (center) -->
<rect x="185" y="215" width="95" height="60" rx="5" fill="white" stroke="black" stroke-width="3"/>
<rect x="190" y="220" width="85" height="50" rx="3" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Sign legs -->
<line x1="200" y1="275" x2="196" y2="290" stroke="black" stroke-width="2.5"/>
<line x1="265" y1="275" x2="269" y2="290" stroke="black" stroke-width="2.5"/>
<!-- Sign text lines (decoration) -->
<path d="M198,234 Q215,228 232,234" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M194,244 Q232,238 268,244" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M196,252 Q230,246 265,252" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M200,260 Q225,254 258,260" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Coffee cup icon on sign -->
<rect x="226" y="230" width="14" height="12" rx="2" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M240,234 Q245,234 245,238 Q245,242 240,242" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M228,230 Q229,226 231,224 Q233,226 234,230" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
</svg>`,
  },

  {
    id: 'underwater_palace',
    name: 'Underwater Palace',
    category: 'fantasy',
    duration: 'hard',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<rect width="400" height="400" fill="white"/>
<!-- Water surface -->
<path d="M0,42 Q25,28 50,42 Q75,56 100,42 Q125,28 150,42 Q175,56 200,42 Q225,28 250,42 Q275,56 300,42 Q325,28 350,42 Q375,56 400,42" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M0,54 Q20,42 40,54 Q60,66 80,54 Q100,42 120,54 Q140,66 160,54" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Light rays from surface -->
<path d="M80,42 Q70,100 80,160" fill="none" stroke="black" stroke-width="1" stroke-dasharray="4,6"/>
<path d="M200,42 Q190,110 200,180" fill="none" stroke="black" stroke-width="1" stroke-dasharray="4,6"/>
<path d="M320,42 Q310,100 320,160" fill="none" stroke="black" stroke-width="1" stroke-dasharray="4,6"/>
<!-- Sand/ocean floor -->
<path d="M0,375 Q100,362 200,370 Q300,378 400,365 L400,400 L0,400 Z" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M0,390 Q80,380 160,388 Q240,396 320,382 Q370,373 400,380" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Sand ripples -->
<path d="M40,385 Q60,381 80,385" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M140,387 Q160,383 180,387" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M260,384 Q280,380 300,384" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M340,387 Q360,383 380,387" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Seaweed pillars left -->
<path d="M25,375 Q15,345 25,315 Q35,285 22,258 Q9,231 22,204 Q35,178 22,152 Q9,126 22,100" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<path d="M22,340 Q2,328 6,314" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M23,296 Q43,284 40,270" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M22,252 Q2,240 6,226" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M22,210 Q42,198 40,184" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Seaweed right -->
<path d="M378,375 Q388,345 378,315 Q368,285 381,258 Q394,231 381,204 Q368,178 381,152 Q394,126 381,100" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<path d="M380,340 Q400,328 396,314" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M379,296 Q359,284 362,270" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M380,252 Q400,240 396,226" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<path d="M380,210 Q360,198 362,184" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round"/>
<!-- Bubbles everywhere -->
<circle cx="55" cy="150" r="6" fill="none" stroke="black" stroke-width="2"/>
<circle cx="48" cy="132" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="60" cy="116" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="345" cy="160" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="355" cy="140" r="7" fill="none" stroke="black" stroke-width="2"/>
<circle cx="342" cy="122" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="160" cy="90" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="240" cy="80" r="5" fill="none" stroke="black" stroke-width="1.5"/>
<circle cx="280" cy="100" r="3.5" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Coral formations left side -->
<path d="M65,375 Q60,350 65,335 M65,335 Q55,322 50,310 M65,335 Q75,320 78,308 M65,335 Q60,318 56,304 M65,335 Q72,318 76,304" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<!-- Anemone right side -->
<circle cx="335" cy="375" r="4" fill="none" stroke="black" stroke-width="2"/>
<path d="M335,371 Q328,358 325,342" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M335,371 Q331,356 330,340" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M335,371 Q335,355 335,339" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M335,371 Q339,356 340,340" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<path d="M335,371 Q342,358 345,342" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Starfish on ground -->
<path d="M100,378 L102,370 L104,378 L110,373 L104,381 L100,378 Z" fill="white" stroke="black" stroke-width="2"/>
<circle cx="102" cy="376" r="4" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M288,380 L290,372 L292,380 L298,375 L292,383 L288,380 Z" fill="white" stroke="black" stroke-width="2"/>
<circle cx="290" cy="378" r="4" fill="none" stroke="black" stroke-width="1.5"/>

<!-- CASTLE (center background) -->
<!-- Castle base / wall -->
<rect x="118" y="240" width="164" height="135" fill="white" stroke="black" stroke-width="3"/>
<!-- Castle wall details (stones) -->
<path d="M118,270 Q200,265 282,270" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M118,300 Q200,295 282,300" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M118,330 Q200,325 282,330" fill="none" stroke="black" stroke-width="1.5"/>
<line x1="150" y1="240" x2="150" y2="375" stroke="black" stroke-width="1"/>
<line x1="182" y1="240" x2="182" y2="375" stroke="black" stroke-width="1"/>
<line x1="218" y1="240" x2="218" y2="375" stroke="black" stroke-width="1"/>
<line x1="250" y1="240" x2="250" y2="375" stroke="black" stroke-width="1"/>
<!-- Castle door (arch) -->
<path d="M176,375 Q176,342 200,336 Q224,342 224,375 Z" fill="none" stroke="black" stroke-width="2.5"/>
<rect x="184" y="355" width="32" height="20" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Left tower -->
<rect x="100" y="215" width="44" height="162" fill="white" stroke="black" stroke-width="3"/>
<!-- Left tower battlements -->
<rect x="98" y="205" width="10" height="14" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="112" y="205" width="10" height="14" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="126" y="205" width="10" height="14" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Left tower window -->
<path d="M112,250 Q122,240 132,250 L132,275 L112,275 Z" fill="none" stroke="black" stroke-width="2"/>
<line x1="122" y1="240" x2="122" y2="275" stroke="black" stroke-width="1.5"/>
<line x1="112" y1="258" x2="132" y2="258" stroke="black" stroke-width="1.5"/>
<!-- Left tower: cute face on tower -->
<circle cx="116" cy="300" r="5" fill="black"/>
<circle cx="128" cy="300" r="5" fill="black"/>
<circle cx="117" cy="298" r="2" fill="white"/>
<circle cx="129" cy="298" r="2" fill="white"/>
<path d="M113,310 Q122,317 131,310" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Right tower -->
<rect x="256" y="215" width="44" height="162" fill="white" stroke="black" stroke-width="3"/>
<rect x="254" y="205" width="10" height="14" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="268" y="205" width="10" height="14" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="282" y="205" width="10" height="14" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M262,250 Q272,240 282,250 L282,275 L262,275 Z" fill="none" stroke="black" stroke-width="2"/>
<line x1="272" y1="240" x2="272" y2="275" stroke="black" stroke-width="1.5"/>
<line x1="262" y1="258" x2="282" y2="258" stroke="black" stroke-width="1.5"/>
<circle cx="266" cy="300" r="5" fill="black"/>
<circle cx="278" cy="300" r="5" fill="black"/>
<circle cx="267" cy="298" r="2" fill="white"/>
<circle cx="279" cy="298" r="2" fill="white"/>
<path d="M263,310 Q272,317 281,310" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<!-- Center tower (tallest) -->
<rect x="172" y="180" width="56" height="62" fill="white" stroke="black" stroke-width="3"/>
<rect x="170" y="168" width="12" height="16" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="186" y="168" width="12" height="16" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="202" y="168" width="12" height="16" fill="white" stroke="black" stroke-width="2.5"/>
<rect x="218" y="168" width="12" height="16" fill="white" stroke="black" stroke-width="2.5"/>
<!-- Center tower window (round, glowing) -->
<circle cx="200" cy="214" r="14" fill="none" stroke="black" stroke-width="2.5"/>
<circle cx="200" cy="214" r="10" fill="none" stroke="black" stroke-width="1.5"/>
<line x1="200" y1="200" x2="200" y2="228" stroke="black" stroke-width="1.5"/>
<line x1="186" y1="214" x2="214" y2="214" stroke="black" stroke-width="1.5"/>
<!-- Center flag -->
<line x1="200" y1="168" x2="200" y2="140" stroke="black" stroke-width="2.5"/>
<path d="M200,140 L222,148 L200,156 Z" fill="white" stroke="black" stroke-width="2"/>
<!-- Castle face above door -->
<circle cx="192" cy="280" r="5" fill="black"/>
<circle cx="208" cy="280" r="5" fill="black"/>
<circle cx="193" cy="278" r="2" fill="white"/>
<circle cx="209" cy="278" r="2" fill="white"/>
<path d="M189,290 Q200,297 211,290" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
<circle cx="184" cy="287" r="6" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>
<circle cx="216" cy="287" r="6" fill="none" stroke="black" stroke-width="1" stroke-dasharray="2,3"/>

<!-- FISH around castle -->
<!-- Top left fish -->
<ellipse cx="90" cy="130" rx="22" ry="15" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M112,130 L124,120 L124,140 Z" fill="white" stroke="black" stroke-width="2.5"/>
<circle cx="76" cy="126" r="7" fill="white" stroke="black" stroke-width="2"/>
<circle cx="77" cy="126" r="3.5" fill="black"/>
<circle cx="78" cy="125" r="1.2" fill="white"/>
<path d="M80,133 Q88,138 95,133" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M88,116 Q96,110 104,116" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M90,144 Q98,150 106,144" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M96,118 Q99,130 96,142" fill="none" stroke="black" stroke-width="1.5"/>
<!-- Top right fish (facing left) -->
<ellipse cx="310" cy="120" rx="22" ry="15" fill="white" stroke="black" stroke-width="2.5"/>
<path d="M288,120 L276,110 L276,130 Z" fill="white" stroke="black" stroke-width="2.5"/>
<circle cx="324" cy="116" r="7" fill="white" stroke="black" stroke-width="2"/>
<circle cx="323" cy="116" r="3.5" fill="black"/>
<circle cx="322" cy="115" r="1.2" fill="white"/>
<path d="M305,127 Q315,132 322,127" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M296,106 Q304,100 312,106" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M298,134 Q306,140 314,134" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Seahorse (right side) -->
<path d="M345,240 Q358,230 360,215 Q358,200 350,198 Q340,198 338,208 Q336,220 344,228 Q350,235 348,248 Q345,260 338,268 Q332,272 334,280 Q336,286 342,284" fill="none" stroke="black" stroke-width="3" stroke-linecap="round"/>
<circle cx="350" cy="195" r="10" fill="white" stroke="black" stroke-width="2.5"/>
<circle cx="345" cy="192" r="3.5" fill="black"/>
<circle cx="346" cy="191" r="1.2" fill="white"/>
<path d="M348,200 Q355,198 358,190" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Seahorse fins/spines -->
<path d="M357,220 L365,215" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M358,228 L367,224" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<path d="M356,236 L365,233" stroke="black" stroke-width="1.5" stroke-linecap="round"/>
<!-- Seahorse belly rings -->
<path d="M338,212 Q342,216 342,222" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M337,222 Q341,226 341,232" fill="none" stroke="black" stroke-width="1.5"/>
<path d="M337,232 Q341,236 341,242" fill="none" stroke="black" stroke-width="1.5"/>
</svg>`,
  },

]

// Normalise image-based pages (new schema) into the internal page shape used
// across the app: { id, name, category, duration, svgContent, imageUrl, ... }.
const NORMALIZED_IMAGE_PAGES = IMAGE_PAGES.map(p => ({
  id: p.id,
  name: p.title,
  category: p.tags?.[0] || 'scenes',
  duration: p.difficulty || 'easy',     // picker tabs use easy/medium/hard
  svgContent: null,                     // image-based — rendered via imageUrl
  imageUrl: p.imageUrl,
  thumbnailUrl: p.thumbnailUrl || p.imageUrl,
  estimatedMinutes: p.estimatedMinutes,
  tags: p.tags || [],
}))

// Image pages first so the new built-in library is the first thing users see.
export const COLORING_PAGES = [...NORMALIZED_IMAGE_PAGES, ...SVG_PAGES]

export function getPagesByDuration(duration) {
  return COLORING_PAGES.filter(p => p.duration === duration)
}
export function getPagesByCategory(category) {
  return COLORING_PAGES.filter(p => p.category === category)
}
export function getPageById(id) {
  return COLORING_PAGES.find(p => p.id === id)
}
