import { EmotionalTone } from '../../types';

/**
 * Response templates for different emotional contexts and personality settings
 */
export class ResponseTemplates {
  /**
   * Gets greeting templates based on time of day and tone
   */
  static getGreetingTemplates(
    timeOfDay: 'morning' | 'afternoon' | 'evening',
    tone: EmotionalTone
  ): string[] {
    const templates: Record<string, string[]> = {
      morning: [
        'Good morning! Ready to make today productive?',
        "Morning! How are you feeling about today's goals?",
        'Hey there! What would you like to accomplish this morning?',
        "Good morning! I'm here to help you have a great day.",
        "Rise and shine! What's on your agenda today?",
        "Morning! Hope you're feeling energized and ready to go.",
        "Good morning! Let's make today amazing together.",
        'Hey! What exciting things are we working on today?',
      ],
      afternoon: [
        "Good afternoon! How's your day going so far?",
        'Afternoon! What can I help you with?',
        'Hey! Ready to tackle the rest of your day?',
        'Good afternoon! How can I support you right now?',
        "Hope your day's been going well! What's next?",
        'Afternoon check-in! How are you feeling?',
        'Hey there! Making good progress today?',
        'Good afternoon! What would you like to focus on?',
      ],
      evening: [
        'Good evening! How did your day go?',
        'Evening! Ready to wind down or still working?',
        'Hey! How can I help you this evening?',
        'Good evening! What would you like to focus on?',
        "Hope you had a productive day! What's left to do?",
        'Evening! Time to wrap things up or keep going?',
        "Hey there! How are you feeling about today's progress?",
        'Good evening! Ready to plan for tomorrow or finish up today?',
      ],
    };

    return this.adjustTemplatesForTone(templates[timeOfDay], tone);
  }

  /**
   * Gets encouragement templates for different situations
   */
  static getEncouragementTemplates(
    situation:
      | 'starting_task'
      | 'struggling'
      | 'making_progress'
      | 'completing_goal',
    tone: EmotionalTone
  ): string[] {
    const templates: Record<string, string[]> = {
      starting_task: [
        "You've got this! Taking the first step is often the hardest part.",
        "Love that you're diving in! I'm here if you need any help.",
        "Perfect! Let's break this down and make it totally manageable.",
        "Yes! Starting is half the battle - you're already winning.",
        "That's the spirit! Ready to tackle this together?",
        "Great energy! Let's turn this into something awesome.",
        "I'm excited to see what you accomplish with this!",
        "Nice! You're building some serious momentum here.",
      ],
      struggling: [
        "Hey, it's totally okay to find this challenging - that means you're growing!",
        "Tough moments don't last, but resilient people like you absolutely do.",
        "Let's take a breath and find a different angle on this.",
        "Remember, every expert was once exactly where you are. You're learning!",
        "This is hard, and that's completely normal. Want to try a different approach?",
        "I can see you're pushing through something difficult. That takes real strength.",
        'Sometimes the best breakthroughs come right after the biggest challenges.',
        "You're not alone in this - let's figure it out together.",
      ],
      making_progress: [
        "Look at you go! You're absolutely crushing this.",
        "This is fantastic! You're building some serious momentum.",
        "I'm genuinely impressed by your consistency and dedication.",
        "You're doing incredible work! This progress is really something.",
        "Wow, you're really in the zone today! Keep riding this wave.",
        "The way you're tackling this is inspiring to watch.",
        "You're making this look easy, but I know the effort you're putting in.",
        'This steady progress is exactly how great things get built.',
      ],
      completing_goal: [
        'Congratulations! You should feel genuinely proud of this accomplishment.',
        "This is incredible work! You've achieved something really meaningful.",
        'Way to go! This is such a significant milestone to celebrate.',
        'Outstanding! Your dedication and hard work have truly paid off.',
        'You did it! This moment deserves all the celebration.',
        "What an achievement! You've turned your vision into reality.",
        "This is huge! You should be so proud of what you've accomplished.",
        "Absolutely amazing! You've proven what you're capable of.",
      ],
    };

    return this.adjustTemplatesForTone(templates[situation], tone);
  }

  /**
   * Gets celebration templates for achievements
   */
  static getCelebrationTemplates(
    achievementType:
      | 'task_completion'
      | 'streak'
      | 'goal_reached'
      | 'productivity_milestone',
    tone: EmotionalTone
  ): string[] {
    const templates: Record<string, string[]> = {
      task_completion: [
        "Task completed! You're absolutely on fire today!",
        "Another one bites the dust! You're building incredible momentum.",
        "Boom! That's another win in the books for you.",
        "Perfect! You're making such steady, solid progress.",
        'Yes! Love seeing you knock these out one by one.',
        "That's what I'm talking about! Another task conquered.",
        "Nicely done! You're really getting into your groove.",
        "Sweet! You're making this productivity thing look easy.",
      ],
      streak: [
        'This streak is absolutely incredible! Your consistency is paying off big time.',
        "Whoa! Look at that consistency - you're genuinely unstoppable right now!",
        'This dedication is inspiring! Your streak shows real commitment.',
        "You're on a roll! These habits you're building are going to change everything.",
        "This consistency is next level! You're proving what you're made of.",
        "I'm genuinely impressed by this streak - you're showing up every single day.",
        'This is the kind of consistency that creates lasting change. Amazing!',
        'Your commitment is showing! This streak is building something powerful.',
      ],
      goal_reached: [
        'Goal achieved! This is absolutely a moment to celebrate and savor!',
        "You did it! You've reached something really important and meaningful.",
        'This is outstanding! Your persistence and hard work have truly paid off.',
        "Congratulations! You've officially conquered this goal - what a feeling!",
        'What an achievement! You turned your vision into reality.',
        'This is huge! You should feel incredibly proud of reaching this milestone.',
        "Goal unlocked! You've proven what you're capable of achieving.",
        "This is the sweet taste of success! You've earned every bit of this victory.",
      ],
      productivity_milestone: [
        "Productivity milestone reached! You're absolutely in the zone today!",
        "This focus is incredible! You're having the kind of day that changes everything.",
        "Your work ethic today is genuinely inspiring! You're achieving amazing things.",
        'This level of productivity is fantastic! You should feel really proud.',
        "You're crushing it today! This kind of focus is what dreams are made of.",
        "The way you're powering through today is absolutely impressive.",
        "This productivity streak is something special - you're really dialed in!",
        "You're making today count in a big way! This focus is incredible to witness.",
      ],
    };

    return this.adjustTemplatesForTone(templates[achievementType], tone);
  }

  /**
   * Gets support templates for stress and challenges
   */
  static getSupportTemplates(
    supportType: 'stress_relief' | 'overwhelm' | 'fatigue' | 'motivation_boost',
    tone: EmotionalTone
  ): string[] {
    const templates: Record<string, string[]> = {
      stress_relief: [
        "I can see you're feeling some real pressure right now. Let's take this one step at a time.",
        "Stress happens to all of us, but let's find ways to make things feel more manageable.",
        "Take a deep breath with me. We'll work through this together, no rush.",
        "It's completely okay to feel stressed. Let's focus on what we can actually control.",
        "I hear you - this feels heavy right now. Let's lighten the load a bit.",
        'Stress is your mind\'s way of saying "this matters." Let\'s honor that and find some relief.',
        "You're not alone in feeling this way. Let's find your calm together.",
        "This pressure you're feeling is real, and so is your ability to handle it.",
      ],
      overwhelm: [
        "Feeling overwhelmed is so completely understandable. Let's prioritize what truly matters most.",
        "When everything feels urgent, let's step back and identify what's genuinely important.",
        "It's totally okay to feel this way - you're human! Let's break things into bite-sized pieces.",
        "Overwhelm often means you care deeply about doing well. Let's channel that into focused action.",
        "I can feel how much you have on your plate. Let's sort through this together.",
        'This feeling of "too much" is so valid. Let\'s find a way to make it feel like "just enough."',
        "You're juggling a lot right now, and that takes real skill. Let's organize the chaos.",
        "Sometimes our ambition outpaces our capacity, and that's human. Let's find balance.",
      ],
      fatigue: [
        "Your energy seems really low right now, and it's so important to listen to your body.",
        "Feeling tired is actually a sign you've been working hard and giving your all.",
        "Low energy is completely normal - you're human, not a machine. Let's find gentle ways to recharge.",
        "Rest isn't just productive, it's essential. Your well-being matters more than any task.",
        "I can sense you're running on empty. That's your body asking for some care.",
        "Fatigue is wisdom - it's telling you to slow down and replenish.",
        "You've been pushing hard, and now it's time to be kind to yourself.",
        'Energy ebbs and flows naturally. Right now, yours is asking for some gentle attention.',
      ],
      motivation_boost: [
        'Your motivation will absolutely return - sometimes we all need a little spark to reignite.',
        'Remember why you started this journey - those reasons are still valid and worth pursuing.',
        'Motivation comes and goes like weather, but your capability and worth remain constant.',
        "Let's rediscover what usually helps you feel energized and full of purpose.",
        "This dip in motivation is temporary. You've felt inspired before, and you will again.",
        'Sometimes we need to rest our motivation muscle before it can flex again.',
        "Your drive is still there, just taking a little breather. Let's coax it back gently.",
        "Even the most motivated people have these moments. It's part of being human.",
      ],
    };

    return this.adjustTemplatesForTone(templates[supportType], tone);
  }

  /**
   * Gets check-in templates for mood tracking
   */
  static getCheckInTemplates(tone: EmotionalTone): string[] {
    const templates = [
      "How are you feeling today? I'd love to check in with you.",
      "What's your energy level like right now?",
      'How would you describe your mood today?',
      "I'm genuinely curious about how you're doing. Care to share?",
      "What's on your mind today? How are you feeling?",
      "Just wanted to check in - how's your headspace today?",
      "I'm here for you. How are things feeling right now?",
      "What's your vibe today? I'd love to know how you're doing.",
    ];

    return this.adjustTemplatesForTone(templates, tone);
  }

  /**
   * Gets farewell templates based on time of day and context
   */
  static getFarewellTemplates(
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'late',
    context: {
      tasksCompleted: number;
      sessionLength: number; // in minutes
      productivity: 'low' | 'medium' | 'high';
    },
    tone: EmotionalTone
  ): string[] {
    const baseTemplates: Record<string, string[]> = {
      morning: [
        'Have a wonderful rest of your morning!',
        'Hope the rest of your morning goes smoothly!',
        'Wishing you a productive and fulfilling morning ahead!',
        'Take care, and make the most of this beautiful morning!',
      ],
      afternoon: [
        'Have a great rest of your afternoon!',
        'Hope your afternoon continues to be productive!',
        'Enjoy the rest of your day!',
        'Take care, and keep up the great work this afternoon!',
      ],
      evening: [
        'Have a lovely evening!',
        'Hope you have a relaxing and peaceful evening!',
        "Enjoy your evening - you've earned it!",
        'Take care, and have a wonderful night!',
      ],
      late: [
        "Get some good rest - you've done enough for today!",
        'Time to wind down. Sleep well when you get there!',
        'Hope you can relax and recharge. Good night!',
        "You've put in good work today. Rest well!",
      ],
    };

    const templates = [...baseTemplates[timeOfDay]];

    // Add context-specific farewells
    if (context.tasksCompleted > 3) {
      templates.push(
        "You accomplished so much today! Feel proud of what you've done.",
        'What a productive session! You should feel great about this progress.',
        'You really made things happen today. Well done!'
      );
    }

    if (context.productivity === 'high') {
      templates.push(
        'You were absolutely in the zone today! That focus was incredible.',
        'The way you powered through today was inspiring to witness.',
        'You had such great energy and focus today. Amazing work!'
      );
    }

    if (context.sessionLength > 120) {
      // More than 2 hours
      templates.push(
        'You put in some serious time today. Make sure to take care of yourself!',
        "That was a marathon session! You've definitely earned some rest.",
        "You showed real dedication today. Don't forget to recharge!"
      );
    }

    return this.adjustTemplatesForTone(templates, tone);
  }

  /**
   * Gets transition templates for moving between tasks
   */
  static getTransitionTemplates(
    transitionType:
      | 'task_to_task'
      | 'work_to_break'
      | 'break_to_work'
      | 'ending_session',
    tone: EmotionalTone
  ): string[] {
    const templates: Record<string, string[]> = {
      task_to_task: [
        'Great work on that! Ready for the next challenge?',
        'Nice job! What would you like to tackle next?',
        "Excellent progress! Let's keep the momentum going.",
        "Well done! What's next on your agenda?",
      ],
      work_to_break: [
        "You've earned a break! Take some time to recharge.",
        'Great work! A little break will help you come back refreshed.',
        "Perfect timing for a break. You've been focused and productive.",
        "Time to step away and give your mind a rest. You've done well!",
      ],
      break_to_work: [
        "Ready to dive back in? You've got this!",
        "Hope you feel refreshed! Let's make the most of this energy.",
        'Welcome back! What would you like to focus on now?',
        "Feeling recharged? Let's tackle what's next together.",
      ],
      ending_session: [
        "What a productive session! You should feel proud of what you've accomplished.",
        "Excellent work today! You've made meaningful progress.",
        "Great job! You've used your time well and achieved good things.",
        "Well done! You can feel good about today's efforts.",
      ],
    };

    return this.adjustTemplatesForTone(templates[transitionType], tone);
  }

  /**
   * Gets weather-based mood templates
   */
  static getWeatherMoodTemplates(
    weather: 'sunny' | 'rainy' | 'cloudy' | 'stormy',
    tone: EmotionalTone
  ): string[] {
    const templates: Record<string, string[]> = {
      sunny: [
        'What a beautiful sunny day! Perfect energy for getting things done.',
        'The sunshine is energizing! How can we make the most of this bright day?',
        'Sunny weather always lifts the spirits! What would you like to accomplish?',
      ],
      rainy: [
        'Rainy days can be perfect for focused indoor work. Cozy and productive!',
        'The rain creates a nice atmosphere for concentration. What shall we work on?',
        "Rainy weather is great for deep work. Let's make the most of this calm energy.",
      ],
      cloudy: [
        'Cloudy days have their own peaceful energy. Great for steady progress.',
        'The overcast sky creates a nice, calm atmosphere for work.',
        'Cloudy weather can be perfect for focused, thoughtful work.',
      ],
      stormy: [
        'Stormy weather outside, but we can create calm and focus inside.',
        'The storm will pass, and we can use this time productively.',
        'Even stormy days can be productive when we create our own calm space.',
      ],
    };

    return this.adjustTemplatesForTone(templates[weather], tone);
  }

  /**
   * Adjusts templates based on emotional tone
   */
  static adjustTemplatesForTone(
    templates: string[],
    tone: EmotionalTone
  ): string[] {
    return templates.map(template => {
      let adjusted = template;

      // Adjust enthusiasm level
      if (tone.enthusiasm > 7) {
        // High enthusiasm: add extra exclamation marks and energetic words
        adjusted = adjusted.replace(/!$/, '!!');
        adjusted = adjusted.replace(/\bGreat\b/g, 'Amazing');
        adjusted = adjusted.replace(/\bGood\b/g, 'Fantastic');
        adjusted = adjusted.replace(/\bNice\b/g, 'Excellent');
        adjusted = adjusted.replace(/\bOkay\b/g, 'Perfect');
        // Add energetic expressions
        if (!adjusted.includes('!')) {
          adjusted = adjusted.replace(/\.$/, '!');
        }
      } else if (tone.enthusiasm < 4) {
        // Low enthusiasm: more subdued language
        adjusted = adjusted.replace(/!!/g, '.');
        adjusted = adjusted.replace(/!/g, '.');
        adjusted = adjusted.replace(/\bAmazing\b/g, 'Good');
        adjusted = adjusted.replace(/\bFantastic\b/g, 'Nice');
        adjusted = adjusted.replace(/\bIncredible\b/g, 'Good');
        adjusted = adjusted.replace(/\bExcellent\b/g, 'Fine');
      }

      // Adjust warmth level
      if (tone.warmth > 7) {
        // High warmth: add personal touches and caring language
        if (
          !adjusted.includes("I'm") &&
          !adjusted.includes('I ') &&
          Math.random() > 0.5
        ) {
          const warmPrefixes = [
            "I'm so happy to help! ",
            "I'm here for you! ",
            'I genuinely care about your success! ',
            "I'm rooting for you! ",
          ];
          const prefix =
            warmPrefixes[Math.floor(Math.random() * warmPrefixes.length)];
          adjusted = prefix + adjusted;
        }
        // Add caring expressions
        adjusted = adjusted.replace(
          /\byou\b/g,
          'you (and I mean this genuinely)'
        );
        adjusted = adjusted.replace(
          /\byou \(and I mean this genuinely\) \(and I mean this genuinely\)/g,
          'you'
        );
      } else if (tone.warmth < 4) {
        // Low warmth: more direct, less personal
        adjusted = adjusted.replace(/I\'m [^!.]*[!.]?\s*/g, '');
        adjusted = adjusted.replace(/\bI\b/g, 'We');
        adjusted = adjusted.replace(/genuinely/g, '');
        adjusted = adjusted.replace(/\s+/g, ' '); // Clean up extra spaces
      }

      // Adjust supportiveness
      if (tone.supportiveness > 7) {
        // High supportiveness: add encouraging and understanding language
        const supportiveWords = {
          difficult: "challenging (and that's completely normal)",
          hard: "tough (and you're handling it well)",
          problem: 'challenge (that we can work through together)',
          mistake: 'learning opportunity',
          failure: 'stepping stone',
        };

        Object.entries(supportiveWords).forEach(([word, replacement]) => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          adjusted = adjusted.replace(regex, replacement);
        });
      }

      // Adjust formality level
      if (tone.formality > 6) {
        // More formal: replace contractions and casual language
        adjusted = adjusted.replace(/you\'re/g, 'you are');
        adjusted = adjusted.replace(/let\'s/g, 'let us');
        adjusted = adjusted.replace(/can\'t/g, 'cannot');
        adjusted = adjusted.replace(/won\'t/g, 'will not');
        adjusted = adjusted.replace(/\bhey\b/gi, 'hello');
        adjusted = adjusted.replace(/\byeah\b/gi, 'yes');
        adjusted = adjusted.replace(/\bokay\b/gi, 'very well');
      } else if (tone.formality < 3) {
        // More casual: add contractions and casual expressions
        adjusted = adjusted.replace(/you are/g, "you're");
        adjusted = adjusted.replace(/let us/g, "let's");
        adjusted = adjusted.replace(/cannot/g, "can't");
        adjusted = adjusted.replace(/will not/g, "won't");
        adjusted = adjusted.replace(/\bhello\b/gi, 'hey');
        adjusted = adjusted.replace(/\byes\b/gi, 'yeah');
        adjusted = adjusted.replace(/\bvery well\b/gi, 'okay');
        // Add casual expressions
        if (Math.random() > 0.7) {
          const casualStarters = ['So, ', 'Well, ', 'Alright, ', 'Cool, '];
          const starter =
            casualStarters[Math.floor(Math.random() * casualStarters.length)];
          adjusted =
            starter + adjusted.toLowerCase().charAt(0) + adjusted.slice(1);
        }
      }

      return adjusted.trim();
    });
  }

  /**
   * Gets a random template from an array
   */
  static getRandomTemplate(templates: string[]): string {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Gets casual conversation starters and responses
   */
  static getCasualConversationTemplates(
    conversationType:
      | 'small_talk'
      | 'check_in'
      | 'encouragement'
      | 'celebration',
    tone: EmotionalTone
  ): string[] {
    const templates: Record<string, string[]> = {
      small_talk: [
        "How's your day shaping up so far?",
        "What's got your attention today?",
        'Anything exciting happening in your world?',
        'How are you feeling about your goals today?',
        "What's on your mind right now?",
        "How's the energy level today?",
        "What's bringing you joy today?",
        'Any interesting challenges coming up?',
      ],
      check_in: [
        "Just wanted to see how you're doing!",
        'How are things feeling for you right now?',
        "I'm here if you need anything - how are you?",
        "Checking in on you - what's your vibe today?",
        "How's your headspace today?",
        "What's your energy like right now?",
        'How are you taking care of yourself today?',
        'Just curious - how are you feeling about everything?',
      ],
      encouragement: [
        "You're doing better than you think you are.",
        "I believe in what you're building here.",
        'Your consistency is really something special.',
        'The way you show up every day is inspiring.',
        "You're making progress, even when it doesn't feel like it.",
        'Your effort is noticed and appreciated.',
        "You're stronger than you realize.",
        "Keep going - you're on the right path.",
      ],
      celebration: [
        'This deserves a moment of appreciation!',
        'You should feel genuinely proud of this!',
        'This is worth celebrating - you did great!',
        'What an accomplishment! This is fantastic!',
        "You've earned this success - enjoy it!",
        'This is the kind of progress that changes everything!',
        "You're proving what you're capable of!",
        'This achievement is a testament to your dedication!',
      ],
    };

    return this.adjustTemplatesForTone(templates[conversationType], tone);
  }

  /**
   * Gets templates based on user's recent activity patterns
   */
  static getContextualTemplates(
    context: {
      timeOfDay: string;
      recentCompletions: number;
      currentStreak: number;
      energyLevel: number;
    },
    tone: EmotionalTone
  ): string[] {
    const templates: string[] = [];

    // Time-based templates
    const hour = parseInt(context.timeOfDay.split(':')[0]);
    if (hour < 12) {
      templates.push(...this.getGreetingTemplates('morning', tone));
    } else if (hour < 17) {
      templates.push(...this.getGreetingTemplates('afternoon', tone));
    } else {
      templates.push(...this.getGreetingTemplates('evening', tone));
    }

    // Activity-based templates
    if (context.recentCompletions > 3) {
      templates.push(
        ...this.getCelebrationTemplates('productivity_milestone', tone)
      );
    }

    if (context.currentStreak > 5) {
      templates.push(...this.getCelebrationTemplates('streak', tone));
    }

    // Energy-based templates
    if (context.energyLevel < 4) {
      templates.push(...this.getSupportTemplates('fatigue', tone));
    } else if (context.energyLevel > 7) {
      templates.push(
        ...this.getEncouragementTemplates('making_progress', tone)
      );
    }

    return templates;
  }
}
