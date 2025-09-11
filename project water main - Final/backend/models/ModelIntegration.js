const mongoose = require('mongoose');

const modelIntegrationSchema = new mongoose.Schema({
  modelType: {
    type: String,
    enum: ['chatbot', 'rag', 'iot_analysis', 'custom'],
    required: true
  },
  modelName: {
    type: String,
    required: true,
    unique: true
  },
  modelPath: {
    type: String,
    required: true
  },
  modelConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  description: {
    type: String
  },
  capabilities: [{
    type: String,
    enum: ['text_generation', 'text_summarization', 'data_analysis', 'prediction', 'classification', 'conversation', 'sentiment_analysis', 'anomaly_detection', 'custom']
  }],
  inputSchema: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  outputSchema: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  performance: {
    accuracy: Number,
    latency: Number,
    throughput: Number,
    lastTested: Date
  },
  usage: {
    totalCalls: { type: Number, default: 0 },
    successfulCalls: { type: Number, default: 0 },
    failedCalls: { type: Number, default: 0 },
    lastUsed: Date
  },
  metadata: {
    author: String,
    tags: [String],
    documentation: String,
    dependencies: [String]
  }
}, {
  timestamps: true
});

// Indexes
modelIntegrationSchema.index({ modelType: 1 });
modelIntegrationSchema.index({ isActive: 1 });
modelIntegrationSchema.index({ modelName: 1 });

// Method to execute model
modelIntegrationSchema.methods.execute = async function(inputData, options = {}) {
  try {
    // Validate input against schema
    if (this.inputSchema && Object.keys(this.inputSchema).length > 0) {
      const validation = this.validateInput(inputData);
      if (!validation.isValid) {
        throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Load and execute model
    const model = await this.loadModel();
    const result = await model.predict(inputData, options);
    
    // Update usage statistics
    this.usage.totalCalls += 1;
    this.usage.successfulCalls += 1;
    this.usage.lastUsed = new Date();
    await this.save();

    return {
      success: true,
      data: result,
      model: this.modelName,
      version: this.version,
      timestamp: new Date()
    };
  } catch (error) {
    // Update usage statistics
    this.usage.totalCalls += 1;
    this.usage.failedCalls += 1;
    await this.save();

    throw error;
  }
};

// Method to load model dynamically
modelIntegrationSchema.methods.loadModel = async function() {
  try {
    const modelPath = require.resolve(this.modelPath);
    const ModelClass = require(modelPath);
    
    // Initialize model with config
    const model = new ModelClass(this.modelConfig);
    
    // Load model if it has a load method
    if (typeof model.load === 'function') {
      await model.load();
    }
    
    return model;
  } catch (error) {
    throw new Error(`Failed to load model ${this.modelName}: ${error.message}`);
  }
};

// Method to validate input
modelIntegrationSchema.methods.validateInput = function(inputData) {
  const errors = [];
  
  if (!this.inputSchema || Object.keys(this.inputSchema).length === 0) {
    return { isValid: true, errors: [] };
  }

  // Basic validation logic - can be extended
  Object.keys(this.inputSchema).forEach(key => {
    const schema = this.inputSchema[key];
    const value = inputData[key];
    
    if (schema.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
    }
    
    if (value !== undefined && schema.type) {
      if (schema.type === 'string' && typeof value !== 'string') {
        errors.push(`${key} must be a string`);
      } else if (schema.type === 'number' && typeof value !== 'number') {
        errors.push(`${key} must be a number`);
      } else if (schema.type === 'array' && !Array.isArray(value)) {
        errors.push(`${key} must be an array`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Static method to find active models by type
modelIntegrationSchema.statics.findActiveByType = function(modelType) {
  return this.find({ modelType, isActive: true });
};

// Static method to get model by name
modelIntegrationSchema.statics.findByName = function(modelName) {
  return this.findOne({ modelName, isActive: true });
};

module.exports = mongoose.model('ModelIntegration', modelIntegrationSchema);
