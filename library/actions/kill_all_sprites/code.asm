LDX.b #!sprite_slots-1
{{label "next"}}:
STZ !14C8,x
DEX
BPL {{label "next"}}
