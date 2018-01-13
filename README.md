## Controlling Onkyo/Pioneer AV receivers from Roon

This project provides a Roon Volume/Source Control extension that allows you to control volume and mute from within Roon. It does so by connecting the receiver via its network interface.


Credits: This code is based on the Denon/Marantz volume control by DocBobo:
https://github.com/docbobo/roon-extension-denon




## Installation

1. Install Node.js from https://nodejs.org.

   * On Windows, install from the above link.
   * On Mac OS, you can use [homebrew](http://brew.sh) to install Node.js.
   * On Linux, you can use your distribution's package manager, but make sure it installs a recent Node.js. Otherwise just install from the above link.

   The extension has been developed with Node v8.0.0. While it may work with older versions, it's not something that I've tested.

1. Install Git from https://git-scm.com/downloads.
   * Following the instructions for the Operating System you are running.

1. Download the Onkyo AVR extension.

   * Go to the [roon-extension-onkyo](https://github.com/marcelveldt/roon-extension-onkyo) page on [GitHub](https://github.com).
   * Click the green 'Clone or Download' button and select 'Download ZIP'.

1. Extract the zip file in a local folder.

1. Change directory to the extension in the local folder:
    ```
    cd <local_folder>/roon-extension-denon
    ```
    *Replace `<local_folder>` with the local folder path.*

1. Install the dependencies:
    ```bash
    npm install
    ```

1. Run it!
    ```bash
    node .
    ```

    The extension should appear in Roon now. See Settings->Setup->Extensions and you should see it in the list. Once it has been properly configured, it can be added as 'Volume Control' extension to an existing output zone.

## Notes

* Setups with more than one Roon Core on the network are not currently tested.
* For source control and power signalling to work correctly, you need to enter the name of the source in the settings for the extension (e.g. cd or aux).
* To turn on the receiver from Roon (and set correct source), you need to make sure that network standby is enabled on the receiver.
