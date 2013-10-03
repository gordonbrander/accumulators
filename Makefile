compile_all:
	make compile_node
	make compile_browser
	make compile_amd

compile_node:
	compile-modules reducers.js preload.js --to node --type 'cjs'

compile_browser:
	compile-modules reducers.js --to browser --type globals --globals reducers
	compile-modules preload.js --to browser --type globals --globals reducers --imports reducers:reducers

compile_amd:
	compile-modules reducers.js --to amd --type 'amd'

tests:
	make compile_node
	node test/reducers.js