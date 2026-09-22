"""Run only Wizgard's private ComfyUI process and exit if its owning Node process dies."""
import os, runpy, sys, threading, time
import psutil
if sys.platform == 'win32':
    import importlib.util
    torch_lib = os.path.join(os.path.dirname(importlib.util.find_spec('torch').origin), 'lib')
    os.environ['PATH'] = torch_lib + os.pathsep + os.environ.get('PATH', '')
    dll_directory = os.add_dll_directory(torch_lib)

owner = psutil.Process(int(os.environ['WIZGARD_PARENT_PID']))
owner_started = owner.create_time()
def watch_owner():
    while True:
        time.sleep(1)
        try:
            if not owner.is_running() or owner.create_time() != owner_started:
                os._exit(0)
        except psutil.Error:
            os._exit(0)
threading.Thread(target=watch_owner, daemon=True).start()
entry = sys.argv.pop(1)
sys.argv[0] = entry
sys.path.insert(0, os.path.dirname(entry))
runpy.run_path(entry, run_name='__main__')
