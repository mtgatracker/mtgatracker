/* =========================================================
 * bootstrap-pincode-input.js
 *
 * =========================================================
 * Created by Ferry Kranenburg
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================= */

;(function ( $, window, document, undefined ) {

	"use strict";


		// Create the defaults once
		var pluginName = "pincodeInput";
		var defaults = {
				placeholders:undefined,							// seperate with a " "(space) to set an placeholder for each input box
		    	inputs:4,									    // 4 input boxes = code of 4 digits long
		    	hidedigits:true,								// hide digits
		    	keydown : function(e){},
		    	change: function(input,value,inputnumber){		// callback on every input on change (keyup event)
		    		//input = the input textbox DOM element
		    		//value = the value entered by user (or removed)
		    		//inputnumber = the position of the input box (in touch mode we only have 1 big input box, so always 1 is returned here)
		    	},
		        complete : function(value, e, errorElement){	// callback when all inputs are filled in (keyup event)
		    		//value = the entered code
		    		//e = last keyup event
		    		//errorElement = error span next to to this, fill with html e.g. : $(errorElement).html("Code not correct");
		    	}
		    };

		// The actual plugin constructor
		function Plugin ( element, options ) {
				this.element = element;
				this.settings = $.extend( {}, defaults, options );
				this._defaults = defaults;
				this._name = pluginName;
				this.init();
		}

		// Avoid Plugin.prototype conflicts
		$.extend(Plugin.prototype, {
				init: function () {
					this.buildInputBoxes();
					
				},
		        updateOriginalInput:function(){
		        	var newValue = "";
		        	$('.pincode-input-text',this._container).each(function( index, value ) {
		        		newValue += $(value).val().toString();
		        	});
		        	$(this.element).val(newValue);
		        },
		        check: function(){
		        	var isComplete = true;
		        	var code = "";
		        	$('.pincode-input-text',this._container).each(function( index, value ) {
		        		code += $(value).val().toString();
		        		if(!$(value).val()){
		        			isComplete = false;
		        		}
		        	});

		        	if(this._isTouchDevice()){
		        		// check if single input has it all
		        		if(code.length == this.settings.inputs){
		        			return true;
		        		}
		        	}else{
		        		return isComplete;
		        	}


		        },
				buildInputBoxes: function () {
					this._container = $('<div />').addClass('pincode-input-container');

					
					
					var currentValue = [];
					var placeholders = [];
					var touchplaceholders = "";  //in touch mode we have just 1 big input box, and there is only 1 placeholder in this case
					
					if(this.settings.placeholders){
						placeholders = this.settings.placeholders.split(" ");
						touchplaceholders = this.settings.placeholders.replace(/ /g,"");
					}
					
					// If we do not hide digits, we need to include the current value of the input box
					// This will only work if the current value is not longer than the number of input boxes.
					if( this.settings.hidedigits == false && $(this.element).val() !=""){
						currentValue = $(this.element).val().split("");
					}

					// make sure this is the first password field here
					//if(this.settings.hidedigits){
					//		this._pwcontainer = $('<div />').css("display", "none").appendTo(this._container);
					//		this._pwfield = $('<input>').attr({'type':'password','pattern': "[0-9]*", 'inputmode':"numeric",'autocomplete':'off'}).appendTo(this._pwcontainer);
					//}

					if(this._isTouchDevice()){
						// set main class
						$(this._container).addClass("touch");
						
						// For touch devices we build a html table directly under the pincode textbox. The textbox will become transparent
						// This table is used for styling only, it will display how many 'digits' the user should fill in.
						// With CSS letter-spacing we try to put every digit visually insize each table cell.
						
						var wrapper = $('<div />').addClass('touchwrapper touch'+this.settings.inputs).appendTo(this._container);
						var input = $('<input>').attr({'type':'number','pattern': "[0-9]*", 'placeholder':touchplaceholders, 'inputmode':"numeric",'maxlength':this.settings.inputs,'autocomplete':'off'}).addClass('form-control pincode-input-text').appendTo(wrapper);
		        		
						var touchtable = $('<table>').addClass('touchtable').appendTo(wrapper);
						var row = $('<tr/>').appendTo(touchtable);
						// create touch background elements (for showing user how many digits must be entered)
						for (var i = 0; i <  this.settings.inputs; i++) {
							if(i == (this.settings.inputs-1)){
								$('<td/>').addClass('last').appendTo(row);
							}else{
								$('<td/>').appendTo(row);
							}							
						}						
						if(this.settings.hidedigits){
							// hide digits
		        			//input.attr('type','password');
		        		}else{
							// show digits, also include default value
							input.val(currentValue[i]);
						}

		        		// add events
		        		this._addEventsToInput(input,1);

					}else{
						// for desktop mode we build one input for each digit
			        	for (var i = 0; i <  this.settings.inputs; i++) {

			        		var input = $('<input>').attr({'type':'text','maxlength':"1",'autocomplete':'off','placeholder':(placeholders[i] ? placeholders[i] : undefined)}).addClass('form-control pincode-input-text').appendTo(this._container);
			        		if(this.settings.hidedigits){
										// hide digits
			        			//input.attr('type','password');
			        		}else{
								// show digits, also include default value
								input.val(currentValue[i]);
							}

			        		if(i==0){
			        			input.addClass('first');
			        		}else if(i==(this.settings.inputs-1)){
			        			input.addClass('last');
			        		}else{
			        			input.addClass('mid');
			        		}

			        		// add events
			        		this._addEventsToInput(input,(i+1));
			        	}
					}


		        	// error box
		        	this._error = $('<div />').addClass('text-danger pincode-input-error').appendTo(this._container);

		        	//hide original element and place this before it
		        	$(this.element).css( "display", "none" );
		            this._container.insertBefore(this.element);
				},
				enable:function(){
					 $('.pincode-input-text',this._container).each(function( index, value ) {
								$(value).prop('disabled', false);
					});
				},
				disable:function(){
					 $('.pincode-input-text',this._container).each(function( index, value ) {
								$(value).prop('disabled', true);
					});
				},
				focus:function(){
					$('.pincode-input-text',this._container).first().select().focus();
				},
				clear:function(){
					 $('.pincode-input-text',this._container).each(function( index, value ) {
		         		$(value).val("");
		         	});
		         	this.updateOriginalInput();
				},
				_isTouchDevice:function(){
					// I know, sniffing is a really bad idea, but it works 99% of the times
					if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
					 	return true;
					}
				},
				_addEventsToInput:function(input,inputnumber){

	        		input.on('focus',function(e){
	        			 this.select();  //automatically select current value
	        		});

	        		input.on('keydown', $.proxy(function(e){
							if(this._pwfield){
								// Because we need to prevent password saving by browser
								// remove the value here and change the type!
								// we do this every time the user types
								$(this._pwfield).attr({'type':'text'});
								$(this._pwfield).val("");
							}

							// prevent more input for touch device (we can't limit it)
							if(this._isTouchDevice()){
								if(e.keyCode  == 8 || e.keyCode  == 46){
									// do nothing on backspace and delete
									
								}else{
									if($(this.element).val().length == this.settings.inputs){
										e.preventDefault();
									    e.stopPropagation();
									}
								}
						
							}else{
								// in desktop mode, check if an number was entered
								try {
									if ( !(e.key == 'Backspace'
											|| e.key == 'Tab'
											|| e.key == 'Delete'
											|| e.key == 'Del'
											|| (e.key >= 0 && e.key <= 9))
									) {
										e.preventDefault();     // Prevent character input
										e.stopPropagation();
									}
								} catch (ex) {
									if( !(e.keyCode == 8                                // backspace key
											|| e.keyCode == 9							// tab key
											|| e.keyCode == 46                          // delete key
											|| (e.keyCode >= 48 && e.keyCode <= 57)     // numbers on keyboard
											|| (e.keyCode >= 96 && e.keyCode <= 105))   // number on keypad
									) {
										e.preventDefault();     // Prevent character input
										e.stopPropagation();

									}
								}
							}

						 this.settings.keydown(e);
		            },this));

	        		input.on('keyup', $.proxy(function(e){
			        	// after every keystroke we check if all inputs have a value, if yes we call complete callback
	        			if(!this._isTouchDevice()){
		        			// on backspace or delete go to previous input box
		        			if(e.keyCode  == 8 || e.keyCode  == 46){
		        				// goto previous
		        				$(e.currentTarget).prev().select();
		    					$(e.currentTarget).prev().focus();
		        			}else{
		        				if($(e.currentTarget).val()!=""){
		            				$(e.currentTarget).next().select();
		        					$(e.currentTarget).next().focus();
		        				}
		        			}
	        			}
	        			
						// update original input box
	        			this.updateOriginalInput();

	        			// oncomplete check
	        			if(this.check()){
	        				this.settings.complete($(this.element).val(), e, this._error);
	        			}
	        			
	        			//onchange event for each input
	        			if(this.settings.change){
	        				this.settings.change(e.currentTarget,$(e.currentTarget).val(),inputnumber);
	        			}
	
	        			
	        			// prevent more input for touch device (we can't limit it)
						if(this._isTouchDevice()){
							if(e.keyCode  == 8 || e.keyCode  == 46){
								// do nothing on backspace and delete								
							}else{
								if($(this.element).val().length == this.settings.inputs){
								    $(e.currentTarget).blur();
								}
							}
					
						}
	        			
			        },this));
				}


		});

		// A really lightweight plugin wrapper around the constructor,
		// preventing against multiple instantiations
		$.fn[ pluginName ] = function ( options ) {
				return this.each(function() {
						if ( !$.data( this, "plugin_" + pluginName ) ) {
								$.data( this, "plugin_" + pluginName, new Plugin( this, options ) );
						}
				});
		};

})( jQuery, window, document );
