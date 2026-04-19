# Classifiers Cheat Sheet QA Report
Generated: 2026-04-17 14:35:33 UTC
Data source: data.json

## Summary
- Total examples: 144
- Icon OK: 110 / MISMATCH: 33
- Pairing OK: 128 / WRONG: 14 / BORDERLINE: 1
- Errors: 1

## Icon mismatches

### คน (PERSON) -- For people; anyone human.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| คนขับ | khon-khàp | driver | `man-construction-worker` | `person-driving` | The icon 'man-construction-worker' is too specific and does not generally represent a 'driver'. |

### คัน (VEHICLE) -- For vehicles and things you steer.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| รถตู้ | rót-dtûu | van | `minibus` | `van` | While many Thai vans (รถตู้) function as minibuses, 'minibus' is a more specific term than 'van' and doesn't cover all types of รถตู้. |

### ลูก (ROUND-THING) -- For round or spherical objects.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| องุ่น | à-ngùn | grape | `grapes` | `single-grape` | The slug 'grapes' typically depicts a bunch, which is less pedagogically clear for a classifier ('ลูก') that applies to a single, individual round object. |
| มะนาว | má-naao | lime | `lemon` | `lime` | The icon slug 'lemon' typically depicts a yellow fruit, whereas 'มะนาว' (má-naao) refers to a green lime, which is visually distinct. |
| ส้ม | sôm | orange | `tangerine` | `orange` | The icon depicts a tangerine, which is a specific type of orange, instead of a general orange. |

### แก้ว (GLASS) -- For drinks served in a glass or cup.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| สมูทตี้ | sà-múut-thîi | smoothie | `bubble-tea` | `smoothie` | A bubble tea icon typically features tapioca pearls, which are not characteristic of a smoothie. |

### ขวด (BOTTLE) -- For anything in a bottle.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| เบียร์ | bia | beer | `beer-mug` | `beer-bottle` | The icon depicts beer in a mug, which pedagogically contradicts the classifier 'ขวด' (bottle) used for the example word 'เบียร์'. |

### จาน / ชาม (PLATE / BOWL) -- จาน for plates of food, ชาม for bowls. Depends on the dish!

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| ข้าวผัด | khâao-phàt | fried rice (จาน) | `cooked-rice` | `fried-rice` | The 'cooked-rice' icon typically depicts plain white rice, not the distinct dish of fried rice. |
| ต้มยำ | dtôm-yam | tom yum (ชาม) | `pot-of-food` | `bowl-with-spoon` | The 'pot-of-food' icon depicts a cooking pot, not a serving bowl that would be classified with ชาม. |
| ผัดกะเพรา | phàt-gà-phrao | basil stir-fry (จาน) | `herb` | `plate-of-food` | The icon depicts a single ingredient (basil) rather than the complete dish of basil stir-fry served on a plate. |
| ข้าวมันไก่ | khâao-man-gài | chicken rice (จาน) | `poultry-leg` | `chicken` | The icon depicts a chicken leg, not the complete dish of chicken rice which typically includes rice and sliced chicken. |

### เรื่อง (STORY) -- For movies, TV shows, novels, and matters.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| เรื่องรัก | rûueang-rák | love story | `heart-with-ribbon` | `romantic-book` | The icon 'heart-with-ribbon' depicts a 'gift of love' but does not pedagogically convey the 'story' or narrative aspect of a love story. |

### ถุง (BAG) -- For bags, packets, and sachets.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| ขนม | khà-nǒm | snacks | `candy` | `potato-chips` | The slug 'candy' is too specific; 'snacks' (ขนม) is a broader category that includes savory items, chips, and various baked goods, not just sweets. |
| มันฝรั่ง | man-fà-ràng | crisps / chips | `french-fries` | `potato-chips` | The 'french-fries' icon depicts fried potato sticks, which are distinct from potato crisps/chips. |
| กาแฟ | gaa-faae | coffee (sachet) | `hot-beverage` | `coffee-sachet` | The 'hot-beverage' icon typically depicts a cup with steam, not a small sealed packet or sachet of coffee. |

### เส้น (STRAND) -- For noodles, roads, strings, and hair.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| เชือก | chûueak | rope | `lasso` | `rope` | The 'lasso' icon depicts a specific type of rope, which can be misleading for the general term 'เชือก' (rope). |

### ครั้ง (TIMES) -- For counting occasions or attempts.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| หลายครั้ง | lǎai khráng | many times | `hundred-points` | `repeat` | The 'hundred-points' emoji (💯) signifies a perfect score or excellence, not the concept of counting occasions or repetition. |
| ครั้งแรก | khráng-râaek | first time | `1st-place-medal` | `sunrise` | The '1st-place-medal' icon implies achievement or winning first place, which is too specific and not universally representative of a general 'first time' or initial occasion. |

### รอบ (ROUNDS) -- For cycles, laps, or showings.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| รอบแรก | râwp-râaek | first round | `1st-place-medal` | `keycap-1` | The icon signifies 'first place' or 'winning,' not 'first round' as an initial stage or sequence. |
| รอบบ่าย | râwp-bàai | afternoon showing | `sun` | `movie-camera` | The 'sun' icon only depicts the 'afternoon' aspect of the example word, failing to represent the 'showing' aspect or the broader meaning of the classifier ('cycles, laps, or showings'). |
| รอบสุดท้าย | râwp-sùt-tháai | final round | `trophy` | `repeat` | A trophy represents the prize for winning, not the concept of a 'round,' 'lap,' or 'cycle' itself. |
| รอบเช้า | râwp-cháo | morning showing | `sunrise` | `film-projector` | The icon 'sunrise' depicts 'morning' (เช้า) but fails to convey the 'showing' (รอบ) aspect of the example word 'รอบเช้า'. |
| รอบค่ำ | râwp-khâm | evening round | `night-with-stars` | `film-reel` | The icon depicts 'evening/night' but does not convey the 'round,' 'cycle,' or 'showing' aspect of the classifier 'รอบ' or the example word 'รอบค่ำ'. |

### ที่ (ORDINAL) -- Turns numbers into 1st, 2nd, 3rd.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| ร้านที่สอง | ráan thîi sǎawng | the 2nd shop | `2nd-place-medal` | `ordinal-number` | The icon implies a competitive ranking or achievement, which is not inherent in simply being 'the 2nd shop' in a sequence. |

### หลัง (ROOF) -- For buildings and houses.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| สำนักงาน | sǎm-nák-ngaan | office | `office` | `office-building` | The slug 'office' is too general and does not pedagogically specify an 'office building,' which is required for the classifier 'หลัง' (for buildings and houses). |

### ห้อง (ROOM) -- For rooms.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| ห้องเรียน | hâwng-riian | classroom | `school` | `classroom` | The 'school' icon typically depicts an entire school building or institution, not specifically a single 'classroom'. |
| ห้องครัว | hâwng-khrua | kitchen | `fork-and-knife` | `cooking-pot` | The 'fork-and-knife' icon represents dining or eating, not the physical kitchen room itself. |

### ฉบับ (COPY) -- For documents, newspapers, and official papers.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| ข้อสอบ | khâw-sàwp | exam paper | `memo` | `clipboard` | A memo typically signifies a short, informal note, which differs from the formal and substantial nature of an exam paper. |
| รายงาน | raai-ngaan | report | `ledger` | `memo` | A ledger is a specific type of financial record, while 'report' is a much broader term that can cover many subjects beyond finance. |

### ชุด (SET) -- For sets, outfits, and matching groups.

| Thai | Translit | English | Current slug | Suggested | Reason |
|---|---|---|---|---|---|
| ชุดจาน | chút-jaan | dish set | `fork-and-knife-with-plate` | `dinnerware-set` | The icon depicts a single place setting, not a comprehensive 'set' of dishes (e.g., multiple plates, bowls, and cups). |
| สูท | sùut | suit | `coat` | `suit` | A coat is a general outer garment, but 'suit' refers to a specific matching set of jacket and trousers/skirt, which 'coat' doesn't fully represent. |
| ชุดนักเรียน | chút-nák-riian | school uniform | `backpack` | `school-uniform` | A backpack is an accessory often associated with school, but it does not depict a 'school uniform' or a 'set' of clothing. |
| ชุดโซฟา | chút-soo-faa | sofa set | `couch-and-lamp` | `sofas-and-armchair` | The icon 'couch-and-lamp' depicts a single sofa with a lamp, which does not accurately represent a 'sofa set' (ชุดโซฟา) as a collection of matching furniture. |

## Pairing mismatches

### WRONG

| Thai | Translit | English | Current classifier | Authentic classifier | Reason |
|---|---|---|---|---|---|
| ไม้จิ้มฟัน | máai-jîm-fan | toothpick | อัน (ITEM) | ก้าน | In authentic Thai, 'ไม้จิ้มฟัน' (toothpick) most commonly takes the classifier 'ก้าน' (kâan), which is used for sticks or slender rods. |
| ยางลบ | yaang-lóp | eraser | อัน (ITEM) | ก้อน | While 'อัน' can serve as a generic classifier, the most authentic and common classifier for 'ยางลบ' (eraser) is 'ก้อน' (kɔ̂n), which specifically refers to lumps, blocks, or pieces. |
| ช้อน | cháawn | spoon | อัน (ITEM) | คัน | While 'อัน' is a general classifier, the most authentic and common classifier for a spoon (ช้อน) is 'คัน', which is used for objects with handles. |
| ซอง | sawng | envelope | ใบ (FLAT-THING) | ซอง | In authentic, everyday Thai, 'ซอง' (envelope/packet) typically acts as its own classifier, rather than taking 'ใบ'. |
| กรรไกร | gan-grai | scissors | เล่ม (VOLUME) | อัน | In authentic Thai, 'กรรไกร' (scissors) is not commonly classified with 'เล่ม'; it is most often classified with 'อัน' or 'คู่'. |
| กล้อง | glâawng | camera | เครื่อง (MACHINE) | ตัว | In authentic, everyday Thai, 'กล้อง' (camera) most commonly takes the classifier 'ตัว' (dtua) rather than 'เครื่อง' (khrueang). |
| ขนมปัง | khà-nǒm-bpang | bread | ชิ้น (PIECE) | แผ่น | For common sliced bread, 'แผ่น' (sheet/slice) is the most idiomatic and frequently used classifier. 'ชิ้น' is typically used for individual bread pastries or irregular pieces, but not for standard slices. |
| ผลไม้ | phǒn-lá-máai | fruit | ถุง (BAG) | ลูก | While one can have 'a bag of fruit' (ผลไม้หนึ่งถุง), 'ถุง' classifies the bag/container, not the fruit itself. Fruit, especially individual pieces, typically takes 'ลูก' (lûuk) or 'ผล' (phǒn). |
| ครั้งหน้า | khráng-nâa | next time | ครั้ง (TIMES) |  | 'ครั้งหน้า' (next time) is a temporal phrase that already incorporates 'ครั้ง' as part of its meaning, not a noun that is classified by 'ครั้ง.' You would not use 'ครั้ง' to classify 'ครั้งหน้า.' |
| บางครั้ง | baang khráng | sometimes | ครั้ง (TIMES) |  | บางครั้ง (sometimes) is an adverbial phrase and does not take a classifier; ครั้ง is part of its composition rather than a classifier it takes. |
| ครั้งแรก | khráng-râaek | first time | ครั้ง (TIMES) |  | The phrase 'ครั้งแรก' (khráng-râaek) literally means 'first occasion' or 'first time', where 'ครั้ง' already functions as the classifier within the phrase. It does not grammatically take 'ครั้ง' as a separate classifier after it. |
| รอบแรก | râwp-râaek | first round | รอบ (ROUNDS) |  | รอบแรก (first round) is a complete noun phrase where รอบ acts as the noun being modified by แรก, and thus does not take รอบ as an additional classifier. |
| วัด | wát | temple | หลัง (ROOF) | แห่ง | In authentic everyday Thai, 'วัด' (temple) as a place or institution usually takes the classifier 'แห่ง' (hàeng), not 'หลัง' (hlang). |
| ใบสมัคร | bai-sà-màk | application | ฉบับ (COPY) | ใบ | In authentic Thai, 'ใบสมัคร' (application form) is classified by 'ใบ' (bai), which is often inherent in the noun itself, not by 'ฉบับ'. |

### BORDERLINE

| Thai | Translit | English | Current classifier | Authentic classifier | Reason |
|---|---|---|---|---|---|
| หนังยาง | nǎng-yaang | rubber band | อัน (ITEM) | เส้น หรือ วง | While 'อัน' is a general fallback, 'หนังยาง' more authentically takes 'เส้น' (for thin, string-like objects) or 'วง' (for loops/rings). |

## Errors

- **เส้น (STRAND)** -- บะหมี่ (egg noodles): Parse failure: Expecting ',' delimiter: line 1 column 226 (char 225)
  Raw response: `{"icon_verdict": "MISMATCH", "icon_reason": "The 'spaghetti' icon depicts a specific type of pasta, which does not accurately represent the appearance of typical Thai 'bà-mìi' egg noodles.", "suggested_slug": "ramen-noodles" (if available and generic enough for noodles) or "noodle-bowl" (if availabl`

## Passed (summary)

- ตัว (BODY): 6/6 OK (icon + pairing)
- ต้น (TREE): 6/6 OK (icon + pairing)
- คู่ (PAIR): 6/6 OK (icon + pairing)
