{{#if button "a"}}
{{#if mode "pressed"}}
LDA $18
{{else}}
LDA $17
{{/if}}
BIT #$80
{{/if}}
{{#if button "b"}}
{{#if mode "pressed"}}
LDA $16
{{else}}
LDA $15
{{/if}}
BIT #$80
{{/if}}
{{#if button "x"}}
{{#if mode "pressed"}}
LDA $18
{{else}}
LDA $17
{{/if}}
BIT #$40
{{/if}}
{{#if button "y"}}
{{#if mode "pressed"}}
LDA $16
{{else}}
LDA $15
{{/if}}
BIT #$40
{{/if}}
{{#if button "l"}}
{{#if mode "pressed"}}
LDA $18
{{else}}
LDA $17
{{/if}}
BIT #$20
{{/if}}
{{#if button "r"}}
{{#if mode "pressed"}}
LDA $18
{{else}}
LDA $17
{{/if}}
BIT #$10
{{/if}}
{{#if button "start"}}
{{#if mode "pressed"}}
LDA $16
{{else}}
LDA $15
{{/if}}
BIT #$10
{{/if}}
{{#if button "select"}}
{{#if mode "pressed"}}
LDA $16
{{else}}
LDA $15
{{/if}}
BIT #$20
{{/if}}
{{#if button "up"}}
{{#if mode "pressed"}}
LDA $16
{{else}}
LDA $15
{{/if}}
BIT #$08
{{/if}}
{{#if button "down"}}
{{#if mode "pressed"}}
LDA $16
{{else}}
LDA $15
{{/if}}
BIT #$04
{{/if}}
{{#if button "left"}}
{{#if mode "pressed"}}
LDA $16
{{else}}
LDA $15
{{/if}}
BIT #$02
{{/if}}
{{#if button "right"}}
{{#if mode "pressed"}}
LDA $16
{{else}}
LDA $15
{{/if}}
BIT #$01
{{/if}}
BEQ {{false}}
