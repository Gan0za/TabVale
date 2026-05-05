# Custom New Tab Extension

This project is a browser extension designed for Microsoft Edge that enhances the new tab experience. It allows users to customize their new tab page with a search bar, a dropdown list of search engines, and the ability to edit this list. Additionally, users can manage bookmarks and change the background image through a context menu.

## Project Structure

- **manifest.json**: The manifest file that describes the extension's properties, permissions, and files used.
- **README.md**: Documentation for the project, including installation and usage instructions.
- **background.js**: Background script that manages extension events, such as creating context menus and handling user actions.
- **newtab/index.html**: HTML file for the new tab page, containing the markup for the search bar and dropdown list of search engines.
- **newtab/styles.css**: Styles for the new tab page, including the design of the search bar and other UI elements.
- **newtab/app.js**: Logic for the new tab page, handling user input, editing the search engine list, and interacting with the context menu.
- **newtab/data.js**: Contains data such as the list of search engines and bookmarks, along with functions for editing and saving them.
- **options/index.html**: HTML file for the options page, where users can edit the list of search engines and bookmarks.
- **options/options.js**: Logic for the options page, handling user changes.
- **assets/icons**: Folder containing icons used in the extension.
- **assets/backgrounds**: Folder containing background images that users can select.
- **_locales/en/messages.json**: Contains localized messages for the extension, enabling multilingual support.

## Installation

1. Download or clone the repository.
2. Open Microsoft Edge and navigate to `edge://extensions`.
3. Enable "Developer mode" in the top right corner.
4. Click on "Load unpacked" and select the project directory.

## Usage

- Open a new tab to see the custom new tab page.
- Use the search bar to search using the selected search engine.
- Right-click on the page to access the context menu for changing the background image or adding bookmarks.
- Navigate to the options page to edit the list of search engines and bookmarks.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.