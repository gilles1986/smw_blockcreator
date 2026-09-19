{{#if side_hitbox}}
; Muncher hitbox: no hit when only the edge pixel touches. $93 = 0: Mario is left of the block, 1: right.
LDA $94
AND #$0F
LDX $93
BEQ {{label "left"}}
EOR #$0F
{{label "left"}}:
CMP #$02
BEQ {{label "safe"}}
{{/if}}
JSL $00F5B7|!bank
{{#if side_hitbox}}
{{label "safe"}}:
{{/if}}
