LDA $77
{{#if side "left"}}
BIT #$02
{{/if}}
{{#if side "right"}}
BIT #$01
{{/if}}
{{#if side "up"}}
BIT #$08
{{/if}}
{{#if side "down"}}
BIT #$04
{{/if}}
BEQ {{false}}
