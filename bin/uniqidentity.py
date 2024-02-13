#!/usr/bin/env python3
"""
MIT License

Copyright (c) 2024 J. Cloud Yu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

"""
This script is used to create an static 'identifier' file at /etc/uniqidentity
that is served as an uniqe identifier for the host.
"""

import os, uuid, stat, time

if os.name == 'nt':
    print("This script doesn't support windows environment!")
    exit(1)

PROFILE_SCRIPT = "/etc/uniqidenty"
try:
    st = os.stat(PROFILE_SCRIPT)
    if not stat.S_ISREG(st.st_mode):
        print(f"{PROFILE_SCRIPT} is a directory!")
        exit(1)
    os.access(PROFILE_SCRIPT, os.R_OK)
except FileNotFoundError:
    pass
except PermissionError:
    print(f"{PROFILE_SCRIPT} is not readable by current user!")
    exit(1)
else:
    with open(PROFILE_SCRIPT, 'r') as f:
        mid = f.readline().split(',')[0]
        print(f"Uniqidentity: {mid}")
    exit(0)



try:
    uuid_val = uuid.uuid4()
    now = int(time.time())
    with open(PROFILE_SCRIPT, 'w') as f:
        os.chmod(PROFILE_SCRIPT, stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
        f.write(f"{uuid_val},{now}\n")
        print(f"Uniqidentity: {uuid_val}")
except PermissionError:
    print(f"/etc is not writable by current user! Unable to generate /etc/uniqidentity file!")
    exit(1)
