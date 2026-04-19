"""Auto-generated Manim scene — deterministic codegen."""

from scene_base import YouTubeScene


class YouTubeOverlay(YouTubeScene):
    """Auto-generated overlay scene."""

    def construct(self):
        self.setup()
        elapsed = 0.0

        # === Block: b-001 (hook) ===
        # Sync to 1.00s (l-0001)
        wait_gap = 1.00 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("สั่งอะไรดีคะ", lang="th", translit="sàng a-rai dii khá")
        self.show_stacked_pair(
            "สั่งอะไรดีคะ",
            "Today you'll learn 8 phrases to order food in Thai like a local.",
            duration=7.0,
            english_delay=2.3,
            translit="sàng a-rai dii khá",
        )
        elapsed += 7.0

        # Sync to 8.00s (l-0002)
        wait_gap = 8.00 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_english_line("What would you like to order?", duration=0.5)
        elapsed += 0.5

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-002 (explain) ===
        # Sync to 9.65s (l-0004)
        wait_gap = 9.65 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_english_line("When I first moved to Bangkok, there was this noodle stall near my apartment. Every morning, the same aunty would shout at me — สั่งอะไรดีคะ — and I had no idea what to say. I just pointed at the picture.", duration=14.3, pos="bottom")
        elapsed += 14.3

        # Sync to 23.95s (l-0005)
        wait_gap = 23.95 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("สั่งอะไรดีคะ", lang="th", translit="sàng a-rai dii khá")
        self.show_thai_line("สั่งอะไรดีคะ", duration=2.3, pos="bottom", translit="sàng a-rai dii khá")
        elapsed += 2.3

        # Sync to 26.25s (l-0006)
        wait_gap = 26.25 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_english_line("By the end of this video, you won't need to point. You'll order in Thai, ask for recommendations, tell them how spicy you want it, and get the bill — all in Thai.", duration=13.35, pos="bottom")
        elapsed += 13.35

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-003 (vocab-card) ===
        # Sync to 39.60s (l-0007)
        wait_gap = 39.60 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_vocab_card(
            "สั่ง",
            "to order",
            "sàng",
            duration=4.85,
            example="คุณอยากสั่งอะไร",
            example_delay=2.3,
        )
        elapsed += 4.85

        # Sync to 44.45s (l-0009)
        wait_gap = 44.45 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_vocab_card(
            "เผ็ด",
            "spicy",
            "phèt",
            duration=2.3,
        )
        elapsed += 2.3

        # Sync to 46.75s (l-0010)
        wait_gap = 46.75 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_vocab_card(
            "ไม่เผ็ด",
            "not spicy",
            "mâi phèt",
            duration=4.7,
            example="ไม่เอาเผ็ดนะคะ",
            example_delay=2.3,
        )
        elapsed += 4.7

        # Sync to 51.45s (l-0012)
        wait_gap = 51.45 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_vocab_card(
            "อร่อย",
            "delicious",
            "a-ròoy",
            duration=4.6,
            example="อร่อยมาก",
            example_delay=2.3,
        )
        elapsed += 4.6

        # Sync to 56.05s (l-0014)
        wait_gap = 56.05 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_vocab_card(
            "ขอ",
            "may I have / I'd like",
            "khǎaw",
            duration=5.45,
            example="ขอผัดไทยหนึ่งจานค่ะ",
            example_delay=2.3,
        )
        elapsed += 5.45

        # Sync to 61.50s (l-0016)
        wait_gap = 61.50 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_vocab_card(
            "เก็บเงิน",
            "check please / bill please",
            "gèp ngern",
            duration=4.85,
            example="เก็บเงินด้วยค่ะ",
            example_delay=2.3,
        )
        elapsed += 4.85

        # Sync to 66.35s (l-0018)
        wait_gap = 66.35 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_vocab_card(
            "แนะนำ",
            "to recommend",
            "náe-nam",
            duration=4.6,
            example="แนะนำอะไรดีคะ",
            example_delay=2.3,
        )
        elapsed += 4.6

        # Sync to 70.95s (l-0020)
        wait_gap = 70.95 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_vocab_card(
            "อิ่ม",
            "full (not hungry)",
            "ìm",
            duration=2.3,
            example="อิ่มแล้วค่ะ",
            example_delay=2.3,
        )
        elapsed += 2.3

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-004 (natural-listen) ===
        # Sync to 77.05s (l-0022)
        wait_gap = 77.05 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("แนะนำอะไรดีคะ", lang="th", translit="náe-nam a-rai dii khá")
        self.show_accumulate("แนะนำอะไรดีคะ", duration=2.3, translit="náe-nam a-rai dii khá")
        elapsed += 2.3

        # Sync to 79.35s (l-0023)
        wait_gap = 79.35 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("ขอผัดไทยหนึ่งจานค่ะ", lang="th", translit="khǎaw phàt-thai nùeng jaan khâ")
        self.show_accumulate("ขอผัดไทยหนึ่งจานค่ะ", duration=3.15, translit="khǎaw phàt-thai nùeng jaan khâ")
        elapsed += 3.15

        # Sync to 82.50s (l-0024)
        wait_gap = 82.50 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("ไม่เอาเผ็ดนะคะ", lang="th", translit="mâi ao phèt ná khá")
        self.show_accumulate("ไม่เอาเผ็ดนะคะ", duration=2.4, translit="mâi ao phèt ná khá")
        elapsed += 2.4

        # Sync to 84.90s (l-0025)
        wait_gap = 84.90 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("อร่อยมาก", lang="th", translit="a-ròoy mâak")
        self.show_accumulate("อร่อยมาก", duration=2.3, translit="a-ròoy mâak")
        elapsed += 2.3

        # Sync to 87.20s (l-0026)
        wait_gap = 87.20 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("อิ่มแล้วค่ะ", lang="th", translit="ìm láaew khâ")
        self.show_accumulate("อิ่มแล้วค่ะ", duration=2.3, translit="ìm láaew khâ")
        elapsed += 2.3

        # Sync to 89.50s (l-0027)
        wait_gap = 89.50 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("เก็บเงินด้วยค่ะ", lang="th", translit="gèp ngern dûuay khâ")
        self.show_accumulate("เก็บเงินด้วยค่ะ", duration=4.05, translit="gèp ngern dûuay khâ")
        elapsed += 4.05

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-005 (breakdown) ===
        # Sync to 93.55s (l-0028)
        wait_gap = 93.55 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_breakdown_triplet(
            "แนะนำอะไรดีคะ",
            "náe-nam a-rai dii khá",
            "What do you recommend?",
            duration=9.3,
            translit_delay=7.0,
            english_delay=8.0,
        )
        elapsed += 9.3

        # Sync to 95.85s (l-0031)
        wait_gap = 95.85 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_breakdown_triplet(
            "ขอผัดไทยหนึ่งจานค่ะ",
            "khǎaw phàt-thai nùeng jaan khâ",
            "I'd like one Pad Thai, please.",
            duration=10.15,
            translit_delay=7.0,
            english_delay=8.0,
        )
        elapsed += 10.15

        # Sync to 99.00s (l-0034)
        wait_gap = 99.00 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_breakdown_triplet(
            "ไม่เอาเผ็ดนะคะ",
            "mâi ao phèt ná khá",
            "No spicy, please.",
            duration=9.4,
            translit_delay=7.0,
            english_delay=8.0,
        )
        elapsed += 9.4

        # Sync to 101.40s (l-0037)
        wait_gap = 101.40 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_breakdown_triplet(
            "อร่อยมาก",
            "a-ròoy mâak",
            "Very delicious!",
            duration=9.3,
            translit_delay=7.0,
            english_delay=8.0,
        )
        elapsed += 9.3

        # Sync to 103.70s (l-0040)
        wait_gap = 103.70 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_breakdown_triplet(
            "เก็บเงินด้วยค่ะ",
            "gèp ngern dûuay khâ",
            "Can I have the bill, please?",
            duration=8.5,
            translit_delay=7.0,
            english_delay=8.0,
        )
        elapsed += 8.5

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-006 (drill-prompt) ===
        # Sync to 107.75s (l-0043)
        wait_gap = 107.75 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_drill_prompt(
            "How would you say: 'I'd like one Pad Thai, please'?",
            duration=7.5,
            try_delay=7.0,
        )
        elapsed += 7.5

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-007 (drill-answer) ===
        # Sync to 113.05s (l-0045)
        wait_gap = 113.05 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("ขอผัดไทยหนึ่งจานค่ะ", lang="th", translit="khǎaw phàt-thai nùeng jaan khâ")
        self.show_thai_line("ขอผัดไทยหนึ่งจานค่ะ", duration=4.65, fade_in=False, translit="khǎaw phàt-thai nùeng jaan khâ")
        elapsed += 4.65

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-008 (drill-prompt) ===
        # Sync to 117.70s (l-0046)
        wait_gap = 117.70 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_drill_prompt(
            "How would you say: 'No spicy, please'?",
            duration=7.5,
            try_delay=7.0,
        )
        elapsed += 7.5

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-009 (drill-answer) ===
        # Sync to 121.95s (l-0048)
        wait_gap = 121.95 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("ไม่เอาเผ็ดนะคะ", lang="th", translit="mâi ao phèt ná khá")
        self.show_thai_line("ไม่เอาเผ็ดนะคะ", duration=3.9, fade_in=False, translit="mâi ao phèt ná khá")
        elapsed += 3.9

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-010 (drill-prompt) ===
        # Sync to 125.85s (l-0049)
        wait_gap = 125.85 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_drill_prompt(
            "How would you say: 'Can I have the bill, please'?",
            duration=7.5,
            try_delay=7.0,
        )
        elapsed += 7.5

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-011 (drill-answer) ===
        # Sync to 131.15s (l-0051)
        wait_gap = 131.15 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("เก็บเงินด้วยค่ะ", lang="th", translit="gèp ngern dûuay khâ")
        self.show_thai_line("เก็บเงินด้วยค่ะ", duration=4.05, fade_in=False, translit="gèp ngern dûuay khâ")
        elapsed += 4.05

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-012 (shadowing) ===
        # Sync to 135.20s (l-0052)
        wait_gap = 135.20 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("แนะ นำ อะไร ดี คะ", lang="th", translit="náe-nam a-rai dii khá")
        self.show_shadowing_line("แนะ นำ อะไร ดี คะ", duration=2.3, highlight=True, translit="náe-nam a-rai dii khá")
        elapsed += 2.3

        # Sync to 137.50s (l-0053)
        wait_gap = 137.50 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("ขอ ผัด ไทย หนึ่ง จาน ค่ะ", lang="th", translit="khǎaw phàt-thai nùeng jaan khâ")
        self.show_shadowing_line("ขอ ผัด ไทย หนึ่ง จาน ค่ะ", duration=3.15, highlight=True, translit="khǎaw phàt-thai nùeng jaan khâ")
        elapsed += 3.15

        # Sync to 140.65s (l-0054)
        wait_gap = 140.65 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("ไม่ เอา เผ็ด นะ คะ", lang="th", translit="mâi ao phèt ná khá")
        self.show_shadowing_line("ไม่ เอา เผ็ด นะ คะ", duration=2.4, highlight=True, translit="mâi ao phèt ná khá")
        elapsed += 2.4

        # Sync to 143.05s (l-0055)
        wait_gap = 143.05 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("อร่อย มาก", lang="th", translit="a-ròoy mâak")
        self.show_shadowing_line("อร่อย มาก", duration=2.3, highlight=True, translit="a-ròoy mâak")
        elapsed += 2.3

        # Sync to 145.35s (l-0056)
        wait_gap = 145.35 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("อิ่ม แล้ว ค่ะ", lang="th", translit="ìm láaew khâ")
        self.show_shadowing_line("อิ่ม แล้ว ค่ะ", duration=2.3, highlight=True, translit="ìm láaew khâ")
        elapsed += 2.3

        # Sync to 147.65s (l-0057)
        wait_gap = 147.65 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("เก็บ เงิน ด้วย ค่ะ", lang="th", translit="gèp ngern dûuay khâ")
        self.show_shadowing_line("เก็บ เงิน ด้วย ค่ะ", duration=4.05, highlight=True, translit="gèp ngern dûuay khâ")
        elapsed += 4.05

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-013 (recap) ===
        # Sync to 151.70s (l-0058)
        wait_gap = 151.70 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_english_line("Quick recap — here are your 8 phrases for ordering food in Thai.", duration=6.35)
        elapsed += 6.35

        # --- Block transition ---
        self.snap_clear()

        # === Block: b-014 (teaser) ===
        # Sync to 158.05s (l-0059)
        wait_gap = 158.05 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.show_english_line("Next time — asking for directions. You'll learn how to say 'where is...?' and understand the answer.", duration=6.25)
        elapsed += 6.25

        # Sync to 164.30s (l-0060)
        wait_gap = 164.30 - elapsed
        if wait_gap > 0.02:
            self.wait(wait_gap)
            elapsed += wait_gap

        self.set_subtitle("...อยู่ที่ไหนคะ", lang="th", translit="...yùu thîi nǎi khá")
        self.show_thai_line("...อยู่ที่ไหนคะ", duration=3.0, fade_in=True, translit="...yùu thîi nǎi khá")
        elapsed += 3.0

