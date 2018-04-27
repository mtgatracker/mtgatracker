# How to stream with MTGATracker

MTGATracker is built with [electron](https://electronjs.org/), and in it's default, desktop mode, it is not super compatible 
with streaming programs like [StreamlabsOBS](https://streamlabs.com/). However, you can tweak MTGATracker
to play more nicely with these programs. These instructions are only for OBS; if you use a different
program, please [let us know how you use it in a PR!](https://github.com/shawkinsl/mtga-tracker/blob/master/CONTRIBUTING.md)

### Option 1: Use full screen capture and use MTGATracker like normal

For this use case, you will have MTGATracker running as an overlay on top of MTGA. This is generally
the easiest method.

1. Launch StreamlabsOBS, MTGA, and MTGATracker (via double clicking the .exe)
1. Create a scene (or use the default)
1. Create a new source (blue):
   - Select "Display Capture" (red)
   ![Creating a scene and display capture in OBS](https://raw.githubusercontent.com/shawkinsl/mtga-tracker/master/.readme_data/stream_guide_1.png)
   - Select the correct display
       - Note: if you are using a computer with multiple GPU's, you may need to use nvidia control
       panel (or similar for your card) to force StreamlabsOBS to use the same card that is driving
       the display
       
You should now have a full display capture working! Simply drag MTGATracker on top of MTGA, and stream away!

### Option 2: Use window capture, and launch MTGATracker framed

For this use case, you will have MTGATracker running in the background, or off to the side of MTGA, and
you will add a separate Window Capture source for MTGATracker, and use OBS to position the window.

1. Launch StreamlabsOBS and MTGA
1. Launch MTGATracker.exe
1. Open the settings window
1. Flip the switch for framed mode to "on"
1. Quit MTGATracker, and start it again
    - You will notice that MTGATracker has an obnoxious green background; this is on purpose and will be helpful later
1. Create a scene (or use the default)
1. Create a new source (blue):
    - Select "Window Capture" (yellow)
    ![Creating a scene and window capture in OBS](https://raw.githubusercontent.com/shawkinsl/mtga-tracker/master/.readme_data/stream_guide_2.png)
    - Find the MTGATracker.exe, select Done
    ![Finding MTGATracker.exe](https://raw.githubusercontent.com/shawkinsl/mtga-tracker/master/.readme_data/stream_guide_3.png)
1. Right click on the Window Capture source and select "Filters"
1. Add a new filter, and choose "Color Key"
1. Set similarity to a value between 600 and 700 depending on your preference (blue), press Done
   - Notice that in the scene, the green is now gone and the background of the window appears transparent! (purple)
    ![Setting filter values](https://raw.githubusercontent.com/shawkinsl/mtga-tracker/master/.readme_data/stream_guide_4.png)
1. (Optional) Set the transparency in the same filter to your preference

You should now have a window capture element displaying MTGATracker that you can position however you want. Note
that you may now minimize MTGATracker, or place it wherever you want on any display.
