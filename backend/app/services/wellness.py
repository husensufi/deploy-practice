from app.schemas.wellness import MovementTutorial, WellnessGame

MOVEMENT_DISCLAIMER = (
    "Yoga and exercise can help manage PCOS symptoms such as weight, insulin "
    "resistance and stress, but they do not cure PCOS. Please check with your "
    "doctor first, especially if you are pregnant, have pain, or any medical condition."
)

MOVEMENT_TUTORIALS = (
    MovementTutorial(
        id="butterfly",
        category="Yoga",
        name="Butterfly Pose (Baddha Konasana)",
        description="Sit, join the soles of your feet, and gently flap your knees. Eases pelvic tension.",
        difficulty="Gentle",
        duration_seconds=30,
        instructions=[
            "Sit upright on a comfortable mat and bring the soles of your feet together.",
            "Hold your feet or ankles and let your knees relax toward the floor.",
            "If comfortable, gently move your knees up and down without forcing the stretch.",
            "Breathe steadily, then release your legs slowly.",
        ],
        video_search_url=(
            "https://www.youtube.com/results?search_query="
            "butterfly+pose+baddha+konasana+for+pcos"
        ),
    ),
    MovementTutorial(
        id="cobra",
        category="Yoga",
        name="Cobra Pose (Bhujangasana)",
        description="Lie on your belly, lift your chest with palms down. Stretches the abdomen and boosts circulation.",
        difficulty="Gentle",
        duration_seconds=30,
        instructions=[
            "Lie on your stomach with your legs relaxed and the tops of your feet on the mat.",
            "Place your palms beside your chest, keeping your elbows close to your body.",
            "Inhale and gently lift your chest only as far as comfortable; keep your hips grounded.",
            "Breathe normally, then exhale and lower your chest slowly.",
        ],
        video_search_url=(
            "https://www.youtube.com/results?search_query="
            "cobra+pose+bhujangasana+for+pcos"
        ),
    ),
    MovementTutorial(
        id="child",
        category="Yoga",
        name="Child's Pose (Balasana)",
        description="Kneel, sit back on heels, fold forward with arms stretched. Calms the mind and relieves cramps.",
        difficulty="Gentle",
        duration_seconds=30,
        instructions=[
            "Kneel on a mat and bring your big toes together, with knees comfortably apart.",
            "Sit your hips back toward your heels; place a cushion under your hips if needed.",
            "Fold forward and rest your arms ahead of you or beside your body.",
            "Take slow, easy breaths and come upright gradually.",
        ],
        video_search_url=(
            "https://www.youtube.com/results?search_query="
            "child+pose+balasana+for+cramps"
        ),
    ),
    MovementTutorial(
        id="bridge",
        category="Yoga",
        name="Bridge Pose (Setu Bandhasana)",
        description="Lie on your back, knees bent, lift your hips. Strengthens the back and pelvic area.",
        difficulty="Gentle",
        duration_seconds=30,
        instructions=[
            "Lie on your back with knees bent, feet hip-width apart and flat on the floor.",
            "Rest your arms by your sides and keep your neck relaxed.",
            "Press gently through your feet and lift your hips only to a comfortable height.",
            "Breathe steadily, lower your spine back down slowly, and rest.",
        ],
        video_search_url=(
            "https://www.youtube.com/results?search_query="
            "bridge+pose+setu+bandhasana+for+pcos"
        ),
    ),
    MovementTutorial(
        id="catcow",
        category="Yoga",
        name="Cat-Cow Stretch (Marjaryasana)",
        description="On hands and knees, arch and round your spine with your breath. Loosens the spine and lower back.",
        difficulty="Gentle",
        duration_seconds=30,
        instructions=[
            "Come onto your hands and knees with wrists below shoulders and knees below hips.",
            "Inhale and gently arch your back, lifting your chest and tailbone for Cow.",
            "Exhale and round your spine gently, letting your head relax for Cat.",
            "Move slowly with your breath and return to a neutral back.",
        ],
        video_search_url=(
            "https://www.youtube.com/results?search_query="
            "cat+cow+stretch+for+period+cramps"
        ),
    ),
    MovementTutorial(
        id="breathing",
        category="Breathing",
        name="Alternate Nostril Breathing (Anulom Vilom)",
        description="Breathe in through one nostril, out through the other, slowly. Reduces stress and anxiety.",
        difficulty="Gentle",
        duration_seconds=30,
        instructions=[
            "Sit comfortably and relax your shoulders; keep your breathing gentle.",
            "Close one nostril lightly and breathe in through the other.",
            "Switch sides and breathe out slowly, then breathe in through that side.",
            "Switch again and breathe out; stop if you feel dizzy or uncomfortable.",
        ],
        video_search_url=(
            "https://www.youtube.com/results?search_query="
            "anulom+vilom+pranayama+for+stress"
        ),
    ),
)

WELLNESS_GAMES = (
    WellnessGame(
        id="bubbles",
        name="Zen Bubbles",
        description="A calm bubble world — pop floating bubbles at your own pace.",
    ),
    WellnessGame(
        id="runner",
        name="Aura Runner",
        description="Switch lanes, dodge stress clouds, and collect self-care hearts.",
    ),
    WellnessGame(
        id="match",
        name="Mind Match",
        description="Flip cards two at a time and find all the self-care pairs.",
    ),
    WellnessGame(
        id="craving",
        name="Guess My Craving",
        description="Answer a few playful questions and see what snack the quiz guesses.",
    ),
)


def get_movement_tutorial(tutorial_id: str) -> MovementTutorial | None:
    return next(
        (tutorial for tutorial in MOVEMENT_TUTORIALS if tutorial.id == tutorial_id),
        None,
    )
