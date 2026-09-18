{{#if style}}
LDA #$02
STA !14C8,x
{{else}}
LDA #$04
STA !14C8,x
PHY
JSL $07FC3B|!bank
PLY
{{/if}}
