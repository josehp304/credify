# Review Authenticity Checker (Chrome Extension)

A Manifest V3 Chrome Extension that uses Gemini API and local heuristics to determine whether product reviews on an e-commerce page are genuine or AI-generated spam.

## ⚙️ How to Install and Load in Chrome
1. Open Google Chrome.
2. In the URL bar, type: `chrome://extensions/` and press enter.
3. Turn on **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the folder where you saved this extension (`extension`).
6. The extension is now installed! You should see the review checker icon in your extensions menu (puzzle piece icon). Pin it to your toolbar for easy access!

## 🔑 Where to add the API Key
You have two options:
**Option 1: Using the Popup (Recommended)**
1. Click on the extension's icon in the Chrome toolbar.
2. Paste your Gemini API Key (`AIzaSy...`) in the provided input box.
3. Click **Save Key**. It will be saved securely to your local browser storage.

**Option 2: Using a local `.env` file**
1. Create a `.env` file in the root of the extension folder.
2. Add the following line: `GEMINI_API_KEY=your_key_here`
The extension will intelligently read the file automatically!

_Note: If you don't enter an API key, the extension will automatically fall back to its offline heuristic system!_

## 🧪 Example Test Pages
- **Amazon**: Open any popular product on Amazon (e.g. headphones or cables), scroll down to the text reviews, and click **Analyze page reviews** in the extension popup.
- **Trustpilot**: Similarly works globally on pages with general review `.review-text` or `div.review` classes.

## ✨ Features Breakdown
- **Dynamic AI Prompting**: Utilizes the exact specified classification guidelines (`{label: 'genuine'|'spam', confidence...}`)
- **Batching & Performance**: API requests are queued and batched seamlessly to prevent rate limit blocking, while still observing the exact requested structure constraint during analysis.
- **Caching**: Repeat reviews are cached temporarily in the background session to avoid burning Gemini API credits.
- **Heuristics Fallback**: Evaluates excessive emojis and buzzwords if not given an LLM key.
- **DOM observer**: Real-time evaluation of conditionally rendered paginated reviews.
- **Dark Mode**: Configured seamlessly for System dark mode.
