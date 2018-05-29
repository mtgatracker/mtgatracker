__author__ = "Kealdor"
__date__ = "$May 28, 2018 8:27:00 PM$"

from sys import platform as _platform
import subprocess

#Set path to MTGA
MTGA_Path = ''

#if _platform == "linux" or _platform == "linux2" or _platform == "darwin":
   # linux &  # MAC OS X
   #print ("Not Supported yet")
    
if _platform == "win32":
   # Windows
   MTGA_Path = os.getenv("ProgramFiles") + "\\Wizards of the Coast\\MTGA\\Mtga.exe"
   
if _platform == "win64":
    # Windows 64-bit
    MTGA_Path = os.getenv("ProgramFiles(x86)") + "\\Wizards of the Coast\\MTGA\\Mtga.exe"

#Set path to MTGA Tracker
MTGA_Tracker_Path = ''

#if _platform == "linux" or _platform == "linux2" or _platform == "darwin":
   # linux &  # MAC OS X
   #print ("Not Supported yet")
    
if _platform == "win32" or _platform == "win64":
   # Windows
   MTGA_Tracker_Path = os.getenv("USERPROFILE") + "\\AppData\\Local\\mtgatracker\\MTGATracker.exe"
   
#Run The Exe's
os.system(MTGA_Path)
os.system(MTGA_Tracker_Path)

#Close The Exe's when needed
n=0# number of instances of the program running 

prog = [line.split() for line in subprocess.check_output("tasklist").splitlines()]
prog.pop(e) for e in [0,1,2]]

for task in prog:
        if task[0]=="MTGA.exe":
            n = 1
    if n > 0:
        return True
    if n = 0:
        os.system("TASKKILL /F /IM MTGATracker.exe")
