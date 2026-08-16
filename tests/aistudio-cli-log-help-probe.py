import subprocess


def run(*args):
    p=subprocess.run(list(args),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=30)
    return (p.stdout or '').lower()

root=run('aistudio','--help')
job=run('aistudio','job','--help')
submit=run('aistudio','submit','--help')
combined='\n'.join([root,job,submit])
assert 'log' in combined
print({'ok':True,'suite':'aistudio-cli-help-log-surface','log_keyword_present':True})
