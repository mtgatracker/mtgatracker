__author__ = "Kealdor"
__date__ = "$May 28, 2018 8:27:00 PM$"

from sys import platform as _platform
import subprocess
import psutil

#Set path to MTGA
mtga_path = ''

#if _platform == "linux" or _platform == "linux2" or _platform == "darwin":
   # linux &  # MAC OS X
   #print ("Not Supported yet")
    
if _platform == "win32":
   # Windows
   mtga_path = os.getenv("ProgramFiles") + "\\Wizards of the Coast\\MTGA\\Mtga.exe"
   
if _platform == "win64":
    # Windows 64-bit
    mtga_path = os.getenv("ProgramFiles(x86)") + "\\Wizards of the Coast\\MTGA\\Mtga.exe"

#Set path to MTGA Tracker
mtga_tracker_path = ''

#if _platform == "linux" or _platform == "linux2" or _platform == "darwin":
   # linux &  # MAC OS X
   #print ("Not Supported yet")
    
if _platform == "win32" or _platform == "win64":
   # Windows
   mtga_tracker_path = os.getenv("USERPROFILE") + "\\AppData\\Local\\mtgatracker\\MTGATracker.exe"
   
#Run The Exe's
os.system(mtga_path)
os.system(mtga_tracker_path)

#Close The Exe's when needed
n = 0 # number of instances of the program running 

prog = [line.split() for line in subprocess.check_output("tasklist").splitlines()]
prog.pop(e) for e in range(3)]

for task in prog:
    if task[0]=="MTGA.exe":
      n = 1
      
    if n > 0:
      return True
   
    if n = 0:
         if _platform == "win32" or _platform == "win64":
            os.system("TASKKILL /F /IM MTGATracker.exe")
         
         #if _platform == "linux" or _platform == "linux2" or _platform == "darwin":
            #for pid in (process.pid for process in psutil.process_iter() if process.name()=="MTGATracker.exe"):
               #os.kill(pid)
