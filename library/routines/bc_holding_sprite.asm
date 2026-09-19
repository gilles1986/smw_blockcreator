; bc_holding_sprite: is Mario carrying a sprite, and which one?
;
; Usage:
;   %bc_holding_sprite()
;   BCC .not_holding
;   ; X = the sprite slot of the carried sprite
;
; Output: carry set and X = the slot of the sprite in status $0B (carried) when Mario holds
;   something; carry clear when he does not.
; Clobbers: A, X

	LDA $1470|!addr		; carrying something ($1470), or holding an object ($148F)
	ORA $148F|!addr
	BEQ ?none
	LDX.b #!sprite_slots-1
?loop:
	LDA !14C8,x
	CMP #$0B
	BEQ ?found
	DEX
	BPL ?loop
?none:
	CLC
	RTL
?found:
	SEC
	RTL
