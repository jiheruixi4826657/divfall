# 神殞 DIVFALL — AI 圖片生成 Prompt 全清單

> 風格目標：**Hades（Supergiant Games）式黑暗奇幻、手繪 2D、強烈打擊感、戲劇性邊緣光、深紫黑＋神聖金配色。**
> 適用工具：Midjourney v6 / DALL·E 3 / Stable Diffusion XL / Adobe Firefly 皆可。

---

## 0. 使用說明（先看這段）

### ★ 通用風格區塊（每一張圖都「貼在 prompt 最後」，確保風格統一）
```
dark fantasy game art, inspired by Hades by Supergiant Games, hand-painted 2D illustration, bold clean ink linework, cel-shaded, dramatic rim lighting with glowing accents, high contrast, rich saturated colors, deep purple-black (#0D0A14) and holy gold (#EF9F27) palette, epic intense action mood, painterly textures, ArtStation quality
```

### ★ 角色／敵人／道具／NPC 追加（要去背的圖才加）
```
full body, dynamic pose, centered composition, isolated on plain flat background, game asset sheet, no shadow on ground
```
> 生成後用去背工具（remove.bg、Photoshop、或 SD 的 rembg）把背景去掉成透明 PNG。

### ★ 負面提示（Stable Diffusion / SDXL 專用，填到 Negative prompt）
```
photo, photorealistic, 3d render, blurry, low detail, watermark, text, signature, ugly, deformed, extra limbs, pixel art, flat lighting, dull washed-out colors, cute chibi, anime moe
```

### ★ 建議比例參數
- 角色 / 敵人 / NPC（直幅人像）：`--ar 2:3`
- 道具圖示（方形）：`--ar 1:1`
- 關卡背景 / 主畫面（橫幅）：`--ar 16:9`
- Midjourney 加 `--style raw --v 6`，畫面更貼近指定風格

---

## A. 主畫面 / 標題風格（橫幅 16:9）

### A1. 登入 / 標題主視覺
```
Epic title splash screen for a dark fantasy roguelite game called "DIVFALL", a shattered colossal god statue falling from a cracked golden sky into an abyss, broken chains, divine light piercing through storm clouds, ominous cathedral ruins below, central empty space for logo, cinematic wide shot,
[貼通用風格區塊] --ar 16:9
```

### A2. 大廳 / 主選單背景（角色選擇畫面後方）
```
Dark fantasy hub sanctuary interior, gothic stone hall with glowing rune pillars, floating embers, a shrine of fallen gods, purple and gold ambient lighting, atmospheric depth, empty foreground for character to stand, concept background art,
[貼通用風格區塊] --ar 16:9
```

---

## B. 關卡背景（5 章，每章一張等距競技場 + 一張 BOSS 場）

> 視角統一加上：`isometric 2.5D top-down angle, tilted arena floor view`，才能對上遊戲鏡頭。

### B1. 第一章・熔鐵廢都（火 / 物理）
```
Isometric 2.5D dark fantasy battle arena, ruined molten iron foundry city, cracked lava channels glowing orange, broken industrial machinery and rusted chains, ember particles, oppressive heat haze, tilted top-down arena floor,
[貼通用風格區塊] --ar 16:9
```
**BOSS 場：**
```
Isometric boss arena inside a giant collapsing iron forge, rivers of molten metal, a colossal anvil throne, intense orange and red glow against purple shadows, dramatic, tilted top-down view,
[貼通用風格區塊] --ar 16:9
```

### B2. 第二章・腐化幽林（木 / 土）
```
Isometric 2.5D dark fantasy arena, corrupted overgrown forest swamp, twisted black trees with glowing green sap, poisonous fog, gnarled roots cracking ancient stone tiles, eerie bioluminescence, tilted top-down arena floor,
[貼通用風格區塊] --ar 16:9
```
**BOSS 場：**
```
Isometric boss arena in a rotting heart of an ancient corrupted tree, massive pulsing roots, toxic green mist, decayed shrine, tilted top-down view,
[貼通用風格區塊] --ar 16:9
```

### B3. 第三章・冰封深淵（冰 / 雷）
```
Isometric 2.5D dark fantasy arena, frozen abyss cavern, jagged blue ice crystals, frozen waterfalls, crackling electric arcs in the air, cold mist, shattered icy floor tiles, tilted top-down arena floor,
[貼通用風格區塊] --ar 16:9
```
**BOSS 場：**
```
Isometric boss arena on a frozen lake under an aurora of lightning, towering ice spires, glowing blue and violet, electric storm, tilted top-down view,
[貼通用風格區塊] --ar 16:9
```

### B4. 第四章・虛空之境（暗 / 光）
```
Isometric 2.5D dark fantasy arena, surreal void realm, floating shattered platforms in endless starless dark, beams of holy light and tendrils of shadow clashing, reality fractures, glowing geometric runes, tilted top-down arena floor,
[貼通用風格區塊] --ar 16:9
```
**BOSS 場：**
```
Isometric boss arena floating in pure void, a throne of light and darkness intertwined, collapsing space, blinding white and deep black with gold edges, tilted top-down view,
[貼通用風格區塊] --ar 16:9
```

### B5. 第五章・神殞聖殿（全屬性 / 最終）
```
Isometric 2.5D dark fantasy final arena, grand fallen-god cathedral in ruins, all elements swirling together (fire ice lightning shadow light), broken stained glass raining divine light, epic scale, golden altar at center, tilted top-down arena floor,
[貼通用風格區塊] --ar 16:9
```
**最終 BOSS 場：**
```
Isometric final boss arena, the seat of a dead god, cosmic cathedral collapsing into the abyss, every element exploding around a central platform, maximum epic intensity, gold and purple and white, tilted top-down view,
[貼通用風格區塊] --ar 16:9
```

---

## C. 角色職業（3 個，各「靜態人像」＋「遊戲內 sprite」）

### C1. VAREK 斷神騎（物理 / 光 / 暗）
**靜態立繪：**
```
A heroic god-severing knight named VAREK, heavy ornate golden plate armor with dark fallen-paladin accents, winged crested helmet with glowing eye slit, wielding a massive divine greatsword, a battle shield on the back, holy gold light radiating with creeping shadow, noble but grim, full body hero portrait,
[貼通用風格區塊] [貼去背追加] --ar 2:3
```
**遊戲內 sprite（俯視斜角）：**
```
Game character sprite of a golden paladin knight, 3/4 top-down isometric view, full body, clear silhouette, holding greatsword and shield, glowing gold armor, readable at small size, clean game asset,
[貼通用風格區塊] [貼去背追加] --ar 1:1
```

### C2. LYRA 術式者（火 / 冰 / 雷 / 木 / 土）
**靜態立繪：**
```
An elemental sorceress named LYRA, flowing teal and deep blue arcane robes with glowing element runes, ornate circlet with a glowing cyan gem, long flowing light-teal hair, holding a tall staff topped with a radiant orb, surrounded by swirling motes of fire ice and lightning, graceful and powerful, full body hero portrait,
[貼通用風格區塊] [貼去背追加] --ar 2:3
```
**遊戲內 sprite（俯視斜角）：**
```
Game character sprite of an elemental mage in teal robes with a glowing staff, 3/4 top-down isometric view, full body, clear silhouette, swirling elemental particles, readable at small size, clean game asset,
[貼通用風格區塊] [貼去背追加] --ar 1:1
```

### C3. KAEL 影刃者（暗 / 物理 / 魔法）
**靜態立繪：**
```
A shadow assassin named KAEL, dark hooded leather cloak with purple shadow aura, sleek face mask covering the lower face, glowing violet eyes, dual curved daggers wreathed in dark energy, agile crouched ready stance, mysterious and lethal, full body hero portrait,
[貼通用風格區塊] [貼去背追加] --ar 2:3
```
**遊戲內 sprite（俯視斜角）：**
```
Game character sprite of a hooded shadow assassin with dual daggers, 3/4 top-down isometric view, full body, clear silhouette, purple shadow trail, glowing eyes, readable at small size, clean game asset,
[貼通用風格區塊] [貼去背追加] --ar 1:1
```

---

## D. 敵人 A / B / C / D（俯視斜角 sprite）

### D1. 敵人 A・腐化雜兵（近戰小怪）
```
Game enemy sprite, a small twisted corrupted humanoid wretch, decayed grey-purple flesh, glowing element-colored eyes, sharp claws, hunched aggressive pose, 3/4 top-down isometric view, full body, clear silhouette, dark fantasy minion,
[貼通用風格區塊] [貼去背追加] --ar 1:1
```

### D2. 敵人 B・腐化術士（遠程施法者）
```
Game enemy sprite, a floating corrupted cultist wraith in tattered hooded robes, casting glowing elemental projectile, skeletal hands, ominous purple-green glow, 3/4 top-down isometric view, full body, clear silhouette, dark fantasy ranged caster,
[貼通用風格區塊] [貼去背追加] --ar 1:1
```

### D3. 敵人 C・重裝魔像（坦克 / 慢速重擊）
```
Game enemy sprite, a massive heavily-armored corrupted stone golem brute, cracked body leaking molten energy, huge fists, slow and menacing, 3/4 top-down isometric view, full body, clear bulky silhouette, dark fantasy heavy enemy,
[貼通用風格區塊] [貼去背追加] --ar 1:1
```

### D4. 敵人 D・墮翼精英（飛行 / 高威脅精英）
```
Game enemy sprite, an elite winged corrupted seraph demon, broken angelic wings, glowing cracked halo, ethereal weapon, fast and dangerous, gold-and-shadow corruption, 3/4 top-down isometric view, full body, clear silhouette, dark fantasy elite enemy,
[貼通用風格區塊] [貼去背追加] --ar 1:1
```

> 想要 BOSS 圖時，把上面任一個改成 `colossal boss, epic scale, multiple glowing weak points, intimidating` 即可。

---

## E. 道具圖示（方形 1:1，發光稀有度）

### E1. 武器圖示（一組）
```
Game item icon set, dark fantasy weapons on dark slate background, a glowing divine greatsword, an arcane staff with orb, a pair of shadow daggers, ornate detailed, golden rim light, rarity glow, clean icon style,
[貼通用風格區塊] --ar 1:1
```

### E2. 防具圖示
```
Game item icon, dark fantasy armor piece, ornate golden-and-purple breastplate with glowing runes, on dark slate background, rarity glow, clean detailed icon,
[貼通用風格區塊] --ar 1:1
```

### E3. 飾品 / 戒指
```
Game item icon, a magical ring with a glowing element gem, ornate metal band, dark slate background, rarity glow, clean detailed icon,
[貼通用風格區塊] --ar 1:1
```

### E4. 補血藥水
```
Game item icon, a glowing red health potion in an ornate vial, dark fantasy, dark slate background, soft glow, clean detailed icon,
[貼通用風格區塊] --ar 1:1
```

### E5. 金幣
```
Game item icon, a pile of glowing golden ancient coins with rune engravings, dark slate background, warm gold glow, clean detailed icon,
[貼通用風格區塊] --ar 1:1
```

### E6. 卡牌（Roguelite 卡片）
```
Game card frame, dark fantasy upgrade card, ornate golden border on deep purple parchment, glowing element sigil in the center, empty space for card art, clean UI asset,
[貼通用風格區塊] --ar 2:3
```

### E7. 卡包 / 寶箱
```
Game item icon, an ornate dark fantasy treasure chest with glowing golden lock and purple energy leaking out, dark slate background, clean detailed icon,
[貼通用風格區塊] --ar 1:1
```

---

## F. NPC（大廳人物，靜態立繪 2:3）

### F1. 商人（商店）
```
A dark fantasy hub merchant NPC, a hooded mysterious trader with a cart of glowing wares, friendly but eerie, purple and gold robes, holding a lantern, full body character portrait,
[貼通用風格區塊] [貼去背追加] --ar 2:3
```

### F2. 鐵匠 / 裝備師
```
A dark fantasy hub blacksmith NPC, a muscular armored smith with a glowing forge hammer, sparks and molten gold, gruff dependable look, full body character portrait,
[貼通用風格區塊] [貼去背追加] --ar 2:3
```

### F3. 神諭者 / 天賦導師
```
A dark fantasy hub oracle NPC, a robed blindfolded seer surrounded by floating glowing constellation runes, mystic and wise, gold and deep blue, full body character portrait,
[貼通用風格區塊] [貼去背追加] --ar 2:3
```

### F4. 大廳守護者 / 接待
```
A dark fantasy hub guardian NPC, a tall ethereal armored sentinel of the fallen gods sanctuary, calm and imposing, glowing gold eyes, full body character portrait,
[貼通用風格區塊] [貼去背追加] --ar 2:3
```

---

## 生成後檔名建議（之後我要接進遊戲用）

| 用途 | 建議檔名 | 放置資料夾 |
|------|---------|-----------|
| 主視覺 | `title_bg.png` | assets/ui/ |
| 大廳背景 | `hub_bg.png` | assets/ui/ |
| 關卡背景 | `ch1_explore.png`、`ch1_boss.png`… | assets/bg/ |
| 角色立繪 | `varek_portrait.png`、`lyra_portrait.png`、`kael_portrait.png` | assets/char/ |
| 角色 sprite | `varek.png`、`lyra.png`、`kael.png` | assets/char/ |
| 敵人 | `enemy_a.png`～`enemy_d.png` | assets/enemy/ |
| 道具 | `icon_weapon.png`、`icon_potion.png`… | assets/item/ |
| NPC | `npc_merchant.png`、`npc_smith.png`… | assets/npc/ |

> 全部生成、去背、命名好之後丟給我，我負責接進遊戲（替換目前的程式向量圖）。
