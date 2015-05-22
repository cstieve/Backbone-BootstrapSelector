define([ 
        'core'
        ],
        function() {

	var selectorUtils = {
			getModelKey: function(model, keyName)
			{
				var key = "";
				if(keyName) {
					key = selectorUtils.getValueFromModelByAttributeName(model, keyName);
				} else {
					key = model.get("key");
				}
				return key;
			},

			getModelValue: function(model, valueName)
			{
				var value = "";
				if(valueName) {
					value = selectorUtils.getValueFromModelByAttributeName(model, valueName);
				} else {
					value = model.get("value");
				}
				return value;
			},

			getValueFromModelByAttributeName: function(model, attributeName)
			{
				var value = "";

				if (_.isArray(attributeName)) {
					_.each(attributeName, function(name,idx) {
						var attributeValue = selectorUtils.getValueFromModelByAttributeName(model, name);
						if(_.isUndefined(attributeValue) || _.isNull(attributeValue)){
							return value;
						}
						
						if(idx > 0){
							value = value + " - ";
						}
						value = value + attributeValue;
					});
				} else if (_.isString(attributeName)) {
					value = model.get(attributeName);
				}

				return value;
			}
	};

	var OptionView = Backbone.View.extend({
		tagName: 'option',

		render: function(options)
		{
			var modelKey = selectorUtils.getModelKey(this.model,options.key),
			modelValue = selectorUtils.getModelValue(this.model,options.value);

			this.$el.attr('value', modelKey).html(modelValue);

			if(this.model.get('disabled')) {
				this.$el.attr('disabled', 'disabled');
			}

			return this;
		}
	});
	
	var OptionGroupView = Backbone.View.extend({
		tagName: 'optgroup',
		optionViews: [],
		reset: function()
		{
			_.each(this.optionViews, function(optionView) {
				optionView.remove();
			});

			this.optionViews = [];
		},
		render: function(options)
		{
			var that = this;
			_.each(this.collection, function(model){
				var optionView = new OptionView({model: model});
				that.optionViews.push(optionView);
				that.$el.append(optionView.render(options.modelAttributes).el);
			});

			this.$el.attr('label', options.label || "");
			
			return this;
		}
	});

	var SelectorView = Backbone.View.extend({
		optionViews: [],
		optionGroupViews: [],
		initialize: function(options) 
		{
			this.options = options || {};
			this.options.modelAttributes = this.options.modelAttributes || {};
			if(_.isUndefined(options.singleOptionAsText)){
				this.options.singleOptionAsText = true; 
			}
			_.bindAll(this, 'addOptions', 'addSingleOption', 'reset', 'renderOptionAsText');
			this.setDisabled(true);
			this.collection.on('sync',this.addOptions);
			this.collection.on('reset',this.reset);

			if(this.options.autoPopulate){
				this.populate();
			}
		},

		addOptions: function()
		{
			this.reset();
			
			if(this.options.groupByAttribute){
				this.addOptionGroups();
			} else {
				this.collection.each(this.addSingleOption);
			}

			if(this.collection.size() === 1) {
				var model = this.collection.at(0);
				if(this.options.singleOptionAsText){
					this.renderOptionAsText(model);
				}
				this.setValue(selectorUtils.getModelKey(model,this.options.modelAttributes.key));
			} else {
				if (this.options.selectedId) {
					this.setValue(this.options.selectedId);
					// Should only be used for initial population, if you re-fetch or populate, the 
					// selectedId may no longer be valid
					delete this.options.selectedId;
				} else {
					// don't pass anything in so it will take the first value
					this.triggerSelectionChange();
				}
			}
			this.setDisabled(false);
		},
		
		addOptionGroups: function()
		{
			var that = this;
			var groupedCollection = this.collection.groupBy(function(model){
				return model.get(that.options.groupByAttribute);
			});
			_.each(_.pairs(groupedCollection), function(group){
				var optionGroupView = new OptionGroupView({'collection': group[1]});
				that.optionGroupViews.push(optionGroupView);
				that.$el.append(optionGroupView.render({'label':group[0], 'modelAttributes': that.options.modelAttributes}).el);
			});
		},

		renderOptionAsText: function(model)
		{
			var modelValue = "";
			if(!_.isUndefined(model)) {
				modelValue = selectorUtils.getModelValue(model,this.options.modelAttributes.value);
			}

			this.$el.before($("<span class='selector-with-single-item form-control-static col-sm-12' style='padding-left:0px;padding-right:0px;'></span>").html(modelValue));
			this.$el.hide();
		},

		addSingleOption: function(model)
		{
			var optionView = new OptionView({model: model});
			this.optionViews.push(optionView);
			this.$el.append(optionView.render(this.options.modelAttributes).el);
		},

		reset: function()
		{
			this.clearTextElementIfPresent();

			_.each(this.optionViews, function(optionView) {
				optionView.remove();
			});

			_.each(this.optionGroupViews, function(optionGroupView) {
				optionGroupView.reset();
				optionGroupView.remove();
			});
			
			this.optionGroupViews = [];
			this.optionViews = [];
		},

		clearTextElementIfPresent: function()
		{
			this.$el.siblings(".selector-with-single-item").remove();
			this.$el.show();
		},

		events: 
		{
			'change': 'triggerSelectionChange'
		},

		getValue: function ()
		{
			return this.$el.val();
		},

		setValue: function (value)
		{
			value = value || "";
			this.$el.val(value);
			this.triggerSelectionChange(null, value);
		},

		triggerSelectionChange: function(event, selectedValue)
		{
			selectedValue = selectedValue || this.$el.val();
			var key = this.options.modelAttributes.key;
			var searchObj = {};
			searchObj[key] = selectedValue;
			var selectedModel = this.collection.findWhere(searchObj);
			this.trigger('selectionChange', selectedValue, selectedModel);
			if(this.options.onSelectionChange){
				this.options.onSelectionChange(selectedValue, selectedModel);
			}
		},

		populateFrom: function(url) 
		{
			this.collection.url = MA.config.baseUrl + '/' + url;
			this.populate();
		},

		populate: function()
		{
			this.setDisabled(true);
			if(this.options.dataProvided){
				this.addOptions();
			} else {
				this.collection.fetch();
			}
		},

		setDisabled: function(disabled)
		{
			this.$el.attr('disabled', disabled);
		},

		render: function()
		{
			return this;
		}
	});

	return SelectorView;
});
