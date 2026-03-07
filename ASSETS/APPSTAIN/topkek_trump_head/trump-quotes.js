/**
 * TOPKEK – gadająca głowa Trumpa (Ronald Dump)
 * Cytaty identyczne z APPSTAIN (CHARACTERS.default w quotes_data.js).
 * Do użycia na stronie TOPKEK – jeden charakter, dymek z cytatami.
 */

(function (global) {
    'use strict';

    const TRUMP_QUOTES = [
        "I have the best words. I actually invented a lot of words. The dictionary people called me, they said, 'Sir, you're coming up with words we've never seen before, they are beautiful words.' And I said, 'You're welcome.'",
        "Abraham Lincoln, honest guy, wore a very tall hat. Maybe too tall, if you ask me. But did he have a golf course in Scotland? No. If I was president back then, the Civil War would have been a Civil Deal. A fantastic deal. Everyone would be happy.",
        "The sharks. I hate them. I told the Navy, 'Get rid of the sharks and I'll give you a budget increase.' They didn't do it. Sad! Now the ocean is a total disaster. Very wet, very dangerous.",
        "I am the most humble person in the history of the universe. Even the Pope said, 'Donald, your humility is blinding.' He had to wear sunglasses inside the Vatican. True story.",
        "My doctors told me my DNA is perfect. They said, 'Sir, we've never seen genes this good.' It's actually a problem because I have too much energy. I don't sleep. Sleep is for low-energy individuals like Jeb.",
        "Global warming is a total hoax. I walked outside yesterday and my ice cream was very cold. It was the coldest ice cream anyone has ever seen. Explain that, scientists.",
        "I know more about wind than anyone. It's very windy, it kills all the birds. You want to see a bird graveyard? Go under a windmill. It's a bird genocide. Terrible!",
        "Nobody loves the Bible more than me. I have many Bibles. I actually signed a few of them for the monks. They were crying, they were so happy. Tears pouring down their faces, saying 'Thank you, Mr. President.'",
        "I could have been a professional basketball player. The NBA begged me. They said, 'Donald, with those hands, you'd be unstoppable.' But I chose real estate. Better ratings.",
        "The aliens, if they exist—and many people say they do—they love me. They won't invade while I'm in charge. They know that if they park a UFO on the White House lawn, I'll tow it. I'll put a boot on it immediately."
    ];

    const DEFAULT_CONFIG = {
        imagePath: 'ASSETS/character_head.png',
        minInterval: 60000,
        maxInterval: 120000,
        displayDurationBase: 3000,
        displayDurationPerChar: 50,
        displayDurationMin: 3000,
        displayDurationMax: 15000,
        clickCooldown: 25000
    };

    function getRandomQuote() {
        return TRUMP_QUOTES[Math.floor(Math.random() * TRUMP_QUOTES.length)];
    }

    function getDisplayDuration(quote, config) {
        const len = quote.length;
        const cfg = config || DEFAULT_CONFIG;
        return Math.max(
            cfg.displayDurationMin,
            Math.min(
                cfg.displayDurationMax,
                cfg.displayDurationBase + len * cfg.displayDurationPerChar
            )
        );
    }

    var clickCooldownUntil = 0;
    var scheduleTimer = null;

    function showQuote(quote, config) {
        var cfg = config || DEFAULT_CONFIG;
        var bubble = document.getElementById('topkek-speech-bubble');
        var text = document.querySelector('.topkek-speech-text');
        if (!bubble || !text) return;

        if (!bubble.classList.contains('hidden')) return;

        text.textContent = quote;
        bubble.classList.remove('hidden');

        var duration = getDisplayDuration(quote, cfg);
        setTimeout(function () {
            bubble.classList.add('hidden');
        }, duration);
    }

    function onHeadClick(config) {
        var cfg = config || DEFAULT_CONFIG;
        var now = Date.now();
        if (now < clickCooldownUntil) return;
        var bubble = document.getElementById('topkek-speech-bubble');
        if (!bubble || !bubble.classList.contains('hidden')) return;

        showQuote(getRandomQuote(), cfg);
        clickCooldownUntil = now + cfg.clickCooldown;
    }

    function scheduleNext(config) {
        var cfg = config || DEFAULT_CONFIG;
        var delay = Math.random() * (cfg.maxInterval - cfg.minInterval) + cfg.minInterval;
        scheduleTimer = setTimeout(function () {
            showQuote(getRandomQuote(), cfg);
            scheduleNext(cfg);
        }, delay);
    }

    function init(options) {
        options = options || {};
        var config = Object.assign({}, DEFAULT_CONFIG, options);
        var headImg = document.getElementById('topkek-trump-head');
        if (headImg && !headImg.dataset.topkekInited) {
            headImg.src = config.imagePath;
            headImg.alt = 'Ronald Dump';
            headImg.dataset.topkekInited = 'true';
            headImg.addEventListener('click', function () { onHeadClick(config); });
        }
        if (scheduleTimer) clearTimeout(scheduleTimer);
        scheduleNext(config);
    }

    global.TopkekTrumpHead = {
        getRandomQuote: getRandomQuote,
        showQuote: showQuote,
        init: init,
        TRUMP_QUOTES: TRUMP_QUOTES,
        DEFAULT_CONFIG: DEFAULT_CONFIG
    };
})(typeof window !== 'undefined' ? window : this);
