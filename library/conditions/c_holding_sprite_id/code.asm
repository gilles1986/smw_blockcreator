%bc_holding_sprite()
BCC {{false}}
{{#if custom}}
LDA !7FAB10,x
AND #$08
BEQ {{false}}
LDA !7FAB9E,x
CMP #{{hex sprite_number 2}}
BNE {{false}}
{{else}}
LDA !9E,x
{{#if sprite_number "218"}}
CMP #$04
{{else}}
{{#if sprite_number "219"}}
CMP #$05
{{else}}
{{#if sprite_number "220"}}
CMP #$06
{{else}}
{{#if sprite_number "221"}}
CMP #$07
{{else}}
{{#if sprite_number "223"}}
CMP #$09
{{else}}
CMP #{{hex sprite_number 2}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
{{/if}}
BNE {{false}}
{{/if}}
