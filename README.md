# Reward Maths Game

## Project Overview
This is a simple math game for kids with login functionality. Users can log in with predefined credentials or proceed with a blank login. The game generates math questions and provides feedback based on the user's answers.

## Predefined Users
- **Username**: `Tom` | **Password**: `Tom1234`
- **Username**: `Patrick` | **Password**: `Patrick1234`
- **Username**: `Eliza` | **Password**: `Eliza1234`

## Deployment Instructions
To deploy the project to the remote server:

1. **Ensure SCP is configured**:
   - Use the private key located at `$env:USERPROFILE\.ssh\id_rsa`.

2. **Upload Files**:
   Run the following command in PowerShell:
   ```powershell
   scp -i $env:USERPROFILE\.ssh\id_rsa c:\Projects\TE_Math\* plantcon@67.20.113.97:/home/plantcon/public_html/website_f273a6c3
   ```

3. **Verify Deployment**:
   - Access the website at `http://rewardmaths.com`.
   - Ensure all files are correctly uploaded and the game functions as expected.

## Troubleshooting
- If the game looks different online:
  - Re-upload all files using the SCP command above.
  - Clear browser cache and refresh the page.

- If login is not working:
  - Check the browser console for errors.
  - Ensure JavaScript is enabled in the browser.

## File Structure
- `index.html`: Main HTML file for the game.
- `styles.css`: CSS file for styling.
- `script.js`: JavaScript file for game logic.
- `favicon.svg`: Favicon for the website.

## Contact
For support, contact the administrator at `admin@rewardmaths.com`. 
