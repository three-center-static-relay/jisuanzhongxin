import inspect
from aistudio_sdk.requests import pipeline as p

names=sorted(n for n in dir(p) if not n.startswith('_'))
assert callable(getattr(p,'query',None))
assert callable(getattr(p,'bosacl_ls_cp',None))
print({'ok':True,'module':'aistudio_sdk.requests.pipeline','public_symbol_count':len(names),'query':True,'bosacl_ls_cp':True})
