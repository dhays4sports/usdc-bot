"""Tracked-file guard. Prints paths/rule names only, never matched values.
Not a replacement for provider-side revocation or a full-history secret scanner.
"""
import pathlib, re, subprocess, sys
paths=subprocess.check_output(['git','ls-files','-z']).decode().split('\0')
findings=[]
for name in filter(None,paths):
 p=pathlib.Path(name)
 if not p.is_file(): continue
 if p.name.startswith('.env') and p.name not in {'.env.example','.env.sample','.env.template'}:
  findings.append((name,'tracked environment file')); continue
 if p.stat().st_size>2_000_000: continue
 data=p.read_bytes()
 if b'\0' in data: continue
 text=data.decode('utf-8',errors='replace')
 if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',text):
  findings.append((name,'private key material'))
 if re.search(r'(?:redis|rediss)://[^\s:/]+:[^\s@]+@',text):
  findings.append((name,'password-bearing Redis URL'))
 if re.search(r'eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}',text):
  findings.append((name,'JWT-shaped credential'))
for name,rule in findings: print('BLOCKED',name,rule)
print('Tracked-file hygiene:',len(findings),'findings; values redacted')
sys.exit(bool(findings))
