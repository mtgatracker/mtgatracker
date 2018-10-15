# -*- mode: python -*-
options = [('u', None, 'OPTION')]
block_cipher = None


a = Analysis(['app\\mtgatracker_backend.py'],
             pathex=['C:\\Users\\Spencatro\\PycharmProjects\\mtga-tools'],
             binaries=[],
             datas=[('electron/package.json', 'electron')],
             hiddenimports=[],
             hookspath=[],
             runtime_hooks=[],
             excludes=[],
             win_no_prefer_redirects=False,
             win_private_assemblies=False,
             cipher=block_cipher)
pyz = PYZ(a.pure, a.zipped_data,
             cipher=block_cipher)
exe = EXE(pyz,
          a.scripts,
          options,
          exclude_binaries=True,
          name='mtgatracker_backend',
          debug=False,
          strip=False,
          upx=True,
          console=True )
coll = COLLECT(exe,
               a.binaries,
               a.zipfiles,
               a.datas,
               strip=False,
               upx=True,
               name='mtgatracker_backend')
