{{#if smoke}}
PHY
JSL $07FC3B|!bank
PLY
{{/if}}
LDA !E4,x
STA $00
LDA !14E0,x
STA $01
LDA !D8,x
STA $02
LDA !14D4,x
STA $03
STZ !14C8,x
{{#if custom}}
LDA #{{hex sprite_number 2}}
SEC
{{else}}
{{#if sprite_number "218"}}
LDA #$04
{{else}}
{{#if sprite_number "219"}}
LDA #$05
{{else}}
{{#if sprite_number "220"}}
LDA #$06
{{else}}
{{#if sprite_number "221"}}
LDA #$07
{{else}}
{{#if sprite_number "223"}}
LDA #$04
{{else}}
LDA #{{hex sprite_number 2}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
CLC
{{/if}}
%spawn_sprite()
BCS {{label "fail"}}
LDA $00
STA !E4,x
LDA $01
STA !14E0,x
LDA $02
STA !D8,x
LDA $03
STA !14D4,x
LDA #{{hex state 2}}
STA !14C8,x
LDA #{{signed x_speed}}
STA !B6,x
LDA #{{signed y_speed}}
STA !AA,x
LDA #$10
STA !154C,x
{{label "fail"}}:
